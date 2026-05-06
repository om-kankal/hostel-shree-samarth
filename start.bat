@echo off
echo Starting Shree Samarth PG Management System...
echo.

echo Starting backend server...
start cmd /k "cd /d %~dp0 && npm run backend"

timeout /t 3 /nobreak > nul

echo Starting frontend server...
start cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://127.0.0.1:5000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul
