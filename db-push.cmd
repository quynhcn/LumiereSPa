@echo off
set "PATH=C:\Users\quynhcn\nodejs\node-v20.18.0-win-x64;%PATH%"
echo Syncing Prisma schema to PostgreSQL database...
call npx prisma db push
