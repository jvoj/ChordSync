#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="styxiInt"
REMOTE_DIR="/home/jav/docker/ChordSync"
GIT_REPO="https://github.com/jvoj/ChordSync.git"
CONTAINER_NAME="chordsync"
IMAGE_NAME="chordsync"

echo "==> Pushing latest code to GitHub..."
git add -A
git diff --cached --quiet || git commit -m "Deploy update

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main

echo "==> Deploying to $REMOTE_HOST:$REMOTE_DIR ..."
ssh "$REMOTE_HOST" bash -s << EOF
set -euo pipefail

# Clone repo if it doesn't exist yet, otherwise pull
if [ ! -d "$REMOTE_DIR/.git" ]; then
  echo "  -> Cloning repository..."
  mkdir -p "$REMOTE_DIR"
  git clone "$GIT_REPO" "$REMOTE_DIR"
else
  echo "  -> Pulling latest changes..."
  git -C "$REMOTE_DIR" pull --rebase
fi

echo "  -> Building Docker image..."
docker build -t $IMAGE_NAME "$REMOTE_DIR"

echo "  -> Stopping old container (if running)..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm   $CONTAINER_NAME 2>/dev/null || true

echo "  -> Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -e VIRTUAL_HOST=svachu.cz \
  -e VIRTUAL_PORT=3000 \
  -e LETSENCRYPT_HOST=svachu.cz \
  -e LETSENCRYPT_EMAIL=vojirja@gmail.com \
  $IMAGE_NAME

echo "  -> Container status:"
docker ps --filter "name=$CONTAINER_NAME" --format "  {{.Names}}  {{.Status}}  {{.Ports}}"
EOF

echo ""
echo "✅ Deploy complete — https://svachu.cz"
