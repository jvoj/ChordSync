import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Load songs from file
  const songsPath = path.join(process.cwd(), "songs.json");
  let songs = JSON.parse(fs.readFileSync(songsPath, "utf-8"));

  const saveSongs = () => fs.writeFileSync(songsPath, JSON.stringify(songs, null, 2), "utf-8");

  // In-memory state
  const rooms: Record<string, { leaderId: string; songId: string | null; scrollPos: number; users: Record<string, string> }> = {};

  app.use(express.json());

  // API Routes
  app.get("/api/songs", (req, res) => {
    res.json(songs);
  });

  app.post("/api/songs", (req, res) => {
    const newSong = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body,
      rating: 0,
      ratingCount: 0,
      playCount: 0,
    };
    songs.push(newSong);
    saveSongs();
    res.json(newSong);
  });

  app.post("/api/songs/:id/rate", (req, res) => {
    const song = songs.find((s: any) => s.id === req.params.id);
    if (!song) return res.status(404).json({ error: "Not found" });
    const value = Math.min(5, Math.max(1, Number(req.body.value)));
    if (isNaN(value)) return res.status(400).json({ error: "Invalid rating" });
    song.rating = Math.round(((song.rating * song.ratingCount + value) / (song.ratingCount + 1)) * 10) / 10;
    song.ratingCount = (song.ratingCount || 0) + 1;
    saveSongs();
    io.emit("song-updated", { id: song.id, rating: song.rating, ratingCount: song.ratingCount, playCount: song.playCount });
    res.json({ rating: song.rating, ratingCount: song.ratingCount });
  });

  app.get("/api/rooms", (req, res) => {
    res.json(Object.entries(rooms).map(([id, data]) => ({ 
      id, 
      userCount: Object.keys(data.users).length,
      songId: data.songId 
    })));
  });

  // Helper to broadcast current rooms to all connected clients
  const broadcastRooms = () => {
    io.emit("rooms-update", Object.entries(rooms).map(([id, data]) => ({
      id,
      userCount: Object.keys(data.users).length,
      songId: data.songId
    })));
  };

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
      broadcastRooms();
    });

    socket.on("become-leader", (roomId: string) => {
      if (rooms[roomId]) {
        rooms[roomId].leaderId = socket.id;
        io.to(roomId).emit("leader-changed", { id: socket.id, name: rooms[roomId].users[socket.id] });
      }
    });

    socket.on("rename-room", ({ oldRoomId, newRoomId }: { oldRoomId: string; newRoomId: string }) => {
      if (!rooms[oldRoomId] || rooms[oldRoomId].leaderId !== socket.id) return;
      if (newRoomId === oldRoomId || !newRoomId.trim()) return;
      // Move room data to new key
      rooms[newRoomId] = { ...rooms[oldRoomId] };
      delete rooms[oldRoomId];
      // Move all socket members to new room
      io.in(oldRoomId).socketsJoin(newRoomId);
      io.in(oldRoomId).socketsLeave(oldRoomId);
      io.to(newRoomId).emit("room-renamed", { oldRoomId, newRoomId });
      broadcastRooms();
    });

    socket.on("sync-scroll", ({ roomId, scrollPos }: { roomId: string; scrollPos: number }) => {
      if (rooms[roomId] && rooms[roomId].leaderId === socket.id) {
        rooms[roomId].scrollPos = scrollPos;
        socket.to(roomId).emit("scroll-update", scrollPos);
      } else {
        console.log(`sync-scroll REJECTED: socket=${socket.id}, expected leader=${rooms[roomId]?.leaderId}`);
      }
    });

    socket.on("sync-song", ({ roomId, songId }: { roomId: string; songId: string }) => {
      if (rooms[roomId] && rooms[roomId].leaderId === socket.id) {
        rooms[roomId].songId = songId;
        socket.to(roomId).emit("song-update", songId);
        console.log(`sync-song OK: songId=${songId} to room ${roomId}`);
        const song = songs.find((s: any) => s.id === songId);
        if (song) {
          song.playCount = (song.playCount || 0) + 1;
          saveSongs();
          io.emit("song-updated", { id: song.id, rating: song.rating, ratingCount: song.ratingCount, playCount: song.playCount });
        }
      } else {
        console.log(`sync-song REJECTED: socket=${socket.id}, expected leader=${rooms[roomId]?.leaderId}`);
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
          broadcastRooms();
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
