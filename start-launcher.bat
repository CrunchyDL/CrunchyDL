@echo off
if exist "launcher\bin\crunchydl-launcher.exe" (
    start "" "launcher\bin\crunchydl-launcher.exe"
) else (
    cd launcher
    npm start
)
