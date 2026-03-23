import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // In-memory state
  const rooms: Record<string, { leaderId: string; songId: string | null; scrollPos: number; users: Record<string, string> }> = {};
  const songs = [
    {
      id: "1",
      title: "Na Ochoz je cesta",
      author: "Tradiční",
      content: "[G]Na Ochoz je [C]cesta, [D]jako žádná [G]ze sta.\n[G]Kdo po ní [C]půjde, [D]ten se neza[G]staví.",
      rating: 4.5
    },
    {
      id: "2",
      title: "Stánky",
      author: "Nedvědi",
      content: "[G]U stánků [C]na levnou [G]krásu\n[G]postávaj [C]a smějou se [G]času\n[G]S cigaretou [C]uprostřed [G]noci\n[G]připadaj si [C]jako [G]otroci.",
      rating: 5.0
    }
  ];

  app.use(express.json());

  // API Routes
  app.get("/api/songs", (req, res) => {
    res.json(songs);
  });

  app.post("/api/songs", (req, res) => {
    const newSong = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body,
      rating: 0
    };
    songs.push(newSong);
    res.json(newSong);
  });

  app.get("/api/rooms", (req, res) => {
    res.json(Object.entries(rooms).map(([id, data]) => ({ 
      id, 
      userCount: Object.keys(data.users).length,
      songId: data.songId 
    })));
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, nickname }: { roomId: string; nickname: string }) => {
      socket.join(roomId);
      
      if (!rooms[roomId]) {
        rooms[roomId] = { leaderId: socket.id, songId: null, scrollPos: 0, users: {} };
      }
      
      rooms[roomId].users[socket.id] = nickname || `Musician ${socket.id.substr(0, 4)}`;
      
      console.log(`User ${rooms[roomId].users[socket.id]} joined room ${roomId}`);
      
      io.to(roomId).emit("room-users", rooms[roomId].users);
      socket.emit("room-state", rooms[roomId]);
    });

    socket.on("become-leader", (roomId: string) => {
      if (rooms[roomId]) {
        rooms[roomId].leaderId = socket.id;
        io.to(roomId).emit("leader-changed", { id: socket.id, name: rooms[roomId].users[socket.id] });
      }
    });

    socket.on("sync-scroll", ({ roomId, scrollPos }: { roomId: string; scrollPos: number }) => {
      if (rooms[roomId] && rooms[roomId].leaderId === socket.id) {
        rooms[roomId].scrollPos = scrollPos;
        socket.to(roomId).emit("scroll-update", scrollPos);
      }
    });

    socket.on("sync-song", ({ roomId, songId }: { roomId: string; songId: string }) => {
      if (rooms[roomId] && rooms[roomId].leaderId === socket.id) {
        rooms[roomId].songId = songId;
        socket.to(roomId).emit("song-update", songId);
      }
    });

    socket.on("disconnect", () => {
      for (const roomId in rooms) {
        if (rooms[roomId].users[socket.id]) {
          const name = rooms[roomId].users[socket.id];
          delete rooms[roomId].users[socket.id];
          io.to(roomId).emit("room-users", rooms[roomId].users);
          
          // If leader left, assign new leader if possible
          if (rooms[roomId].leaderId === socket.id) {
            const remainingUsers = Object.keys(rooms[roomId].users);
            if (remainingUsers.length > 0) {
              rooms[roomId].leaderId = remainingUsers[0];
              io.to(roomId).emit("leader-changed", { id: remainingUsers[0], name: rooms[roomId].users[remainingUsers[0]] });
            } else {
              delete rooms[roomId];
            }
          }
          break;
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
