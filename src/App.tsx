import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, Music, Plus, ChevronLeft, Star, Radio, Sun, Moon, Maximize, Minimize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import socket from './services/socket';
import { SongDisplay } from './components/SongDisplay';
import type { Song, Room } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function StarRating({ song, onRate }: { song: Song; onRate: (value: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onRate(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-125"
          title={`Ohodnotit ${n}/5`}
        >
          <Star
            size={18}
            className={cn(
              "transition-colors",
              (hovered || song.rating) >= n ? "text-amber-400 fill-amber-400" : "text-stone-300 dark:text-stone-600"
            )}
          />
        </button>
      ))}
      {song.ratingCount > 0 && (
        <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">
          {song.rating.toFixed(1)} ({song.ratingCount})
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'home' | 'song' | 'add'>('home');
  const [songs, setSongs] = useState<Song[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'alpha' | 'rating' | 'plays'>('alpha');
  const [renamingRoom, setRenamingRoom] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [nickname, setNickname] = useState(() => localStorage.getItem('chord-nickname') || '');
  const [roomUsers, setRoomUsers] = useState<Record<string, string>>({});
  const [leaderInfo, setLeaderInfo] = useState<{ id: string; name: string } | null>(null);
  const [showNickPrompt, setShowNickPrompt] = useState(!localStorage.getItem('chord-nickname'));
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('chord-theme') === 'dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('chord-fontsize') || 16));

  const changeFontSize = (delta: number) => {
    setFontSize(prev => {
      const next = Math.min(32, Math.max(11, prev + delta));
      localStorage.setItem('chord-fontsize', String(next));
      return next;
    });
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('chord-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('chord-theme', 'light');
    }
  }, [isDarkMode]);

  // Fetch data once on mount
  useEffect(() => {
    fetchSongs();
    fetchRooms();
  }, []);

  // Socket listeners — re-register when songs or isLeader changes so closures stay fresh
  useEffect(() => {
    socket.on('scroll-update', (pos: number) => {
      if (!isLeader && scrollRef.current) {
        isSyncing.current = true;
        scrollRef.current.scrollTop = pos;
        setTimeout(() => { isSyncing.current = false; }, 50);
      }
    });

    socket.on('song-update', (songId: string) => {
      if (!isLeader) {
        const song = songs.find(s => s.id === songId);
        if (song) setCurrentSong(song);
      }
    });

    socket.on('leader-changed', (info: { id: string; name: string }) => {
      setLeaderInfo(info);
      if (info.id === socket.id) setIsLeader(true);
      else setIsLeader(false);
    });

    socket.on('room-users', (users: Record<string, string>) => {
      setRoomUsers(users);
    });

    socket.on('room-renamed', ({ oldRoomId, newRoomId }: { oldRoomId: string; newRoomId: string }) => {
      setCurrentRoom(prev => prev === oldRoomId ? newRoomId : prev);
      setRenamingRoom(false);
    });

    socket.on('rooms-update', (updatedRooms: { id: string; userCount: number; songId: string | null }[]) => {
      setRooms(updatedRooms);
    });

    socket.on('song-updated', ({ id, rating, ratingCount, playCount }: { id: string; rating: number; ratingCount: number; playCount: number }) => {
      setSongs(prev => prev.map(s => s.id === id ? { ...s, rating, ratingCount, playCount } : s));
      setCurrentSong(prev => prev?.id === id ? { ...prev, rating, ratingCount, playCount } : prev);
    });

    socket.on('room-state', (state: any) => {
      if (state.songId) {
        const song = songs.find(s => s.id === state.songId);
        if (song) setCurrentSong(song);
      }
      if (state.scrollPos && scrollRef.current) {
        scrollRef.current.scrollTop = state.scrollPos;
      }
    });

    return () => {
      socket.off('scroll-update');
      socket.off('song-update');
      socket.off('leader-changed');
      socket.off('room-users');
      socket.off('room-renamed');
      socket.off('rooms-update');
      socket.off('song-updated');
      socket.off('room-state');
    };
  }, [songs, isLeader]);

  const fetchSongs = async () => {
    const res = await fetch('/api/songs');
    const data = await res.json();
    setSongs(data);
  };

  const fetchRooms = async () => {
    const res = await fetch('/api/rooms');
    const data = await res.json();
    setRooms(data);
  };

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoom(roomId);
    socket.emit('join-room', { roomId, nickname });
    setView('song');
  };

  const handleCreateRoom = () => {
    const roomId = `svachu-crew-${Math.random().toString(36).substr(2, 5)}`;
    handleJoinRoom(roomId);
    setIsLeader(true);
    socket.emit('become-leader', roomId);
  };

  const handleRenameRoom = (newName: string) => {
    if (!newName.trim() || !currentRoom) return;
    socket.emit('rename-room', { oldRoomId: currentRoom, newRoomId: newName.trim() });
  };

  const handleScroll = () => {
    if (isLeader && currentRoom && scrollRef.current && !isSyncing.current) {
      socket.emit('sync-scroll', {
        roomId: currentRoom,
        scrollPos: scrollRef.current.scrollTop
      });
    }
  };

  const handleSongSelect = (song: Song) => {
    setCurrentSong(song);
    if (isLeader && currentRoom) {
      socket.emit('sync-song', { roomId: currentRoom, songId: song.id });
    }
    setView('song');
  };

  const handleRate = async (song: Song, value: number) => {
    const res = await fetch(`/api/songs/${song.id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, rating: data.rating, ratingCount: data.ratingCount } : s));
    if (currentSong?.id === song.id) setCurrentSong(prev => prev ? { ...prev, rating: data.rating, ratingCount: data.ratingCount } : prev);
  };

  const saveNickname = (name: string) => {
    setNickname(name);
    localStorage.setItem('chord-nickname', name);
    setShowNickPrompt(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const filteredSongs = songs
    .filter(s =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.author.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'plays') return b.playCount - a.playCount;
      return a.title.localeCompare(b.title, 'cs');
    });

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 transition-colors duration-300">
      {/* Nickname Prompt */}
      {showNickPrompt && (
        <div className="fixed inset-0 z-[100] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6 border border-stone-200 dark:border-stone-800"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                <Users size={32} />
              </div>
              <h2 className="text-2xl font-bold">Vítejte!</h2>
              <p className="text-stone-500 dark:text-stone-400">Zadejte přezdívku pro připojení k jam session.</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const name = (e.currentTarget.elements.namedItem('nick') as HTMLInputElement).value;
              if (name) saveNickname(name);
            }}>
              <input 
                name="nick"
                autoFocus
                placeholder="Vaše přezdívka..."
                className="w-full p-4 bg-stone-100 dark:bg-stone-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
              />
              <button className="w-full mt-4 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Hrát!
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Header */}
      {!isFullscreen && (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => { setView('home'); setCurrentRoom(null); setIsLeader(false); }}
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Music size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Kordy</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                title={isDarkMode ? "Světlý režim" : "Tmavý režim"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div
                className="flex items-center gap-2 px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-sm font-medium cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                title="Klikni pro změnu přezdívky"
                onClick={() => setShowNickPrompt(true)}
              >
                <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center uppercase">
                  {nickname ? nickname[0] : '?'}
                </div>
                <span>{nickname || 'Nastav přezdívku'}</span>
              </div>
              {currentRoom && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800">
                  <Users size={14} />
                  <span>{Object.keys(roomUsers).length} online</span>
                </div>
              )}
              <button 
                onClick={() => setView('add')}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                title="Přidat písničku"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={cn("max-w-4xl mx-auto p-4 transition-all duration-300", isFullscreen && "max-w-none p-0 h-screen overflow-hidden")}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Search + Sort */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <input
                    type="text"
                    placeholder="Hledat písničky nebo autory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Řadit:</span>
                  {(['alpha', 'rating', 'plays'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                        sortBy === opt
                          ? "bg-blue-600 text-white"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
                      )}
                    >
                      {opt === 'alpha' ? '🔤 A–Z' : opt === 'rating' ? '⭐ Hodnocení' : '🎵 Přehrávání'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Rooms */}
              {rooms.length > 0 && (
                <section className="space-y-4">
                  <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <Radio size={16} className="text-red-500 animate-pulse" />
                    Aktivní skupiny
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rooms.map(room => (
                      <button
                        key={room.id}
                        onClick={() => handleJoinRoom(room.id)}
                        className="flex items-center justify-between p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group"
                      >
                        <div>
                          <div className="font-bold text-stone-800 dark:text-stone-200">{room.id}</div>
                          <div className="text-sm text-stone-500 dark:text-stone-400">{room.userCount} připojených hudebníků</div>
                        </div>
                        <Users size={20} className="text-stone-300 dark:text-stone-700 group-hover:text-blue-500 transition-colors" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Songs Grid */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Všechny písničky</h2>
                  <button 
                    onClick={handleCreateRoom}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={16} /> Založit novou skupinu
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSongs.map(song => (
                    <div
                      key={song.id}
                      onClick={() => handleSongSelect(song)}
                      className="p-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{song.title}</h3>
                        <div className="flex items-center gap-1 text-amber-500 shrink-0">
                          <Star size={14} fill="currentColor" />
                          <span className="text-sm font-bold">{song.rating > 0 ? song.rating.toFixed(1) : '–'}</span>
                        </div>
                      </div>
                      <p className="text-stone-500 dark:text-stone-400 mb-4">{song.author}</p>
                      <div className="flex items-center gap-3 text-xs font-medium text-stone-400 dark:text-stone-600 uppercase tracking-tighter">
                        <span className="flex items-center gap-1"><Music size={12} /> Akordy</span>
                        {song.playCount > 0 && <span className="flex items-center gap-1">🎵 {song.playCount}×</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'song' && !currentSong && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-stone-400 dark:text-stone-500 gap-4"
            >
              <button
                onClick={() => { setView('home'); }}
                className="absolute top-6 left-6 flex items-center gap-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <ChevronLeft size={20} /> Zpět
              </button>
              <Music size={48} className="opacity-30" />
              <p className="text-lg font-medium">Čekám na výběr písničky od vedoucího…</p>
              <p className="text-sm">Nebo vyberte písničku níže</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 max-h-96 overflow-y-auto w-full max-w-2xl px-4">
                {songs.map(song => (
                  <button
                    key={song.id}
                    onClick={() => handleSongSelect(song)}
                    className="text-left p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                  >
                    <div className="font-semibold text-stone-800 dark:text-stone-200 text-sm">{song.title}</div>
                    <div className="text-xs text-stone-400">{song.author}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'song' && currentSong && (
            <motion.div
              key="song"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={cn("flex flex-col", isFullscreen ? "h-screen p-6" : "h-[calc(100vh-120px)]")}
            >
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => { setView('home'); if(isFullscreen) toggleFullscreen(); }}
                  className="flex items-center gap-1 text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                >
                  <ChevronLeft size={20} />
                  <span>Zpět</span>
                </button>

                {/* Room name + rename */}
                {currentRoom && (
                  renamingRoom ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => { e.preventDefault(); handleRenameRoom(roomNameInput); }}
                    >
                      <input
                        autoFocus
                        value={roomNameInput}
                        onChange={e => setRoomNameInput(e.target.value)}
                        className="px-3 py-1 rounded-lg border border-blue-400 text-sm font-medium bg-white dark:bg-stone-900 outline-none focus:ring-2 focus:ring-blue-500 w-40"
                      />
                      <button type="submit" className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg">OK</button>
                      <button type="button" onClick={() => setRenamingRoom(false)} className="text-xs px-2 py-1 bg-stone-200 dark:bg-stone-700 rounded-lg">Zrušit</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setRoomNameInput(currentRoom); setRenamingRoom(true); }}
                      className="text-sm font-semibold text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                      title="Přejmenovat skupinu"
                    >
                      {currentRoom} <span className="text-xs text-stone-400">✏️</span>
                    </button>
                  )
                )}
                
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2 overflow-hidden">
                    {Object.entries(roomUsers).map(([id, name]) => (
                      <div 
                        key={id} 
                        title={name as string}
                        className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-stone-900 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase"
                      >
                        {(name as string).substring(0, 2)}
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={toggleFullscreen}
                    className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500 dark:text-stone-400"
                    title={isFullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"}
                  >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>

                  {/* Font size */}
                  <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 rounded-full px-1">
                    <button
                      onClick={() => changeFontSize(-1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-stone-600 dark:text-stone-300 text-lg leading-none"
                      title="Zmenšit písmo"
                    >−</button>
                    <span className="text-xs font-mono text-stone-400 w-6 text-center">{fontSize}</span>
                    <button
                      onClick={() => changeFontSize(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-stone-600 dark:text-stone-300 text-lg leading-none"
                      title="Zvětšit písmo"
                    >+</button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={isLeader} 
                        onChange={(e) => {
                          if (e.target.checked && currentRoom) {
                            socket.emit('become-leader', currentRoom);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-stone-200 dark:bg-stone-800 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">Vedoucí</span>
                  </label>
                </div>
              </div>

              {!isFullscreen && (
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h2 className="font-black tracking-tight mb-1 text-4xl">{currentSong.title}</h2>
                    <p className="text-stone-500 dark:text-stone-400 text-xl">{currentSong.author}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <StarRating song={currentSong} onRate={(v) => handleRate(currentSong, v)} />
                      {currentSong.playCount > 0 && (
                        <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                          🎵 Zahráno {currentSong.playCount}×
                        </span>
                      )}
                    </div>
                  </div>
                  {leaderInfo && (
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">Aktuální vedoucí</div>
                      <div className="text-sm font-bold flex items-center gap-2 justify-end">
                        <Radio size={14} className="text-blue-600 dark:text-blue-400" />
                        {leaderInfo.name}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className={cn(
                  "flex-1 overflow-y-auto pr-4 scroll-smooth bg-white dark:bg-stone-900 p-8 border border-stone-200 dark:border-stone-800 shadow-inner rounded-3xl",
                  isFullscreen && "border-none shadow-none"
                )}
              >
                <SongDisplay content={currentSong.content} fontSize={fontSize} />
                <div className="h-96" /> {/* Spacer for scrolling */}
              </div>
            </motion.div>
          )}

          {view === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('home')} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full">
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-3xl font-bold">Přidat novou písničku</h2>
              </div>

              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const songData = {
                  title: formData.get('title'),
                  author: formData.get('author'),
                  content: formData.get('content'),
                };
                await fetch('/api/songs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(songData)
                });
                fetchSongs();
                setView('home');
              }}>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Název</label>
                  <input name="title" required className="w-full p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Autor</label>
                  <input name="author" required className="w-full p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Obsah (Akordy v [závorkách])</label>
                  <textarea 
                    name="content" 
                    required 
                    rows={10} 
                    placeholder="[G]Ahoj [C]světe..."
                    className="w-full p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none">
                  Uložit písničku
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
