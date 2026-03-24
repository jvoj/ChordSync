# MarineNajdiToto Deployment & Development Guide

## 🚀 Jak aplikaci nasadit (Deploy)

V prostředí **Google AI Studio Build** je nasazení velmi jednoduché:
1. V pravém horním rohu klikněte na tlačítko **"Deploy"**.
2. Aplikace se automaticky zabalí a nasadí do služby **Google Cloud Run**.
3. Po dokončení získáte veřejnou URL adresu, kterou můžete sdílet s ostatními.

## 📦 Jak kód exportovat (Commit/GitHub)

Pokud chcete na projektu pracovat mimo AI Studio (např. ve VS Code nebo s jinými AI nástroji):
1. Klikněte na ikonu **Settings** (ozubené kolečko ⚙️) v pravém horním rohu.
2. Vyberte možnost **"Export to GitHub"**. Tím se vytvoří nový repozitář s celým kódem.
3. Alternativně můžete zvolit **"Download ZIP"** a stáhnout si kód k sobě do počítače.

## 🐳 Docker

Vytvořil jsem pro vás soubor `Dockerfile`. Pokud máte Docker nainstalovaný, můžete aplikaci spustit lokálně příkazem:
```bash
docker build -t chordsync .
docker run -p 3000:3000 chordsync
```

## 🛠️ Vývojový proces

Aplikace používá **Express** jako backend a **Vite** pro frontend. 
- **Backend (`server.ts`)**: Stará se o API a WebSocket (Socket.io) komunikaci.
- **Frontend (`src/`)**: React aplikace se synchronizací scrollování.
- **Produkce**: V produkčním režimu server automaticky servíruje sestavené soubory ze složky `dist/`.
