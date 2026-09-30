@echo off
set "PATH=C:\Users\quynhcn\nodejs\node-v20.18.0-win-x64;%PATH%"
echo Node version:
node -v
echo NPM version:
call npm -v
echo Installing packages...
call npm install
