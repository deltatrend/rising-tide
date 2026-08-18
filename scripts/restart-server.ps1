# Frees port 3000 before starting the production server.
#
# `npm start` spawns `next start` as a child process, so killing the npm process
# leaves the server holding the port and the next `npm start` silently fails
# with EADDRINUSE while stale code keeps answering requests.

param([int]$Port = 3000)

$owner = (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($owner) {
  Write-Host "Stopping process $owner listening on port $Port"
  Stop-Process -Id $owner -Force
  Start-Sleep -Seconds 1
}

npm start
