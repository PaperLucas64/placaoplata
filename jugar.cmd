@echo off
rem Malandro en esta compu, sin internet: doble clic y se abre el juego en el navegador.
rem Solo se puede entrar desde esta misma compu (no queda online). Para cerrarlo, cerrá esta ventana.
rem La partida se guarda en .data\juego (aparte de la de npm run dev, que usa .data\pg).
cd /d "%~dp0"
echo Armando la pantalla...
call npm run build -w apps/web >nul || goto :error
set NODE_ENV=production
set PGLITE=1
set PORT=3100
set HOST=127.0.0.1
set DATA_DIR=.data\juego
echo.
echo Malandro en http://localhost:3100  (cerra esta ventana para apagarlo)
start "" /b cmd /c "timeout /t 8 >nul & start "" http://localhost:3100"
call npm start
goto :eof
:error
echo No se pudo armar la pantalla. Fijate que este instalado Node.js (npm install la primera vez).
pause
