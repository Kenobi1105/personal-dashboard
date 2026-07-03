@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo Personal Dashboard Supabase deployment
echo ======================================
echo.

where supabase >nul 2>nul
if errorlevel 1 (
  echo ERROR: Supabase CLI was not found.
  echo Install it first, then run this file again.
  echo https://supabase.com/docs/guides/cli
  goto fail
)

echo Deploying Edge Functions...
supabase functions deploy news-sources
if errorlevel 1 goto fail
supabase functions deploy news
if errorlevel 1 goto fail
supabase functions deploy rss
if errorlevel 1 goto fail
supabase functions deploy article
if errorlevel 1 goto fail
supabase functions deploy bible-net
if errorlevel 1 goto fail
supabase functions deploy sports
if errorlevel 1 goto fail
supabase functions deploy world-watch
if errorlevel 1 goto fail
supabase functions deploy missions
if errorlevel 1 goto fail
supabase functions deploy languages
if errorlevel 1 goto fail
supabase functions deploy dashboard-sync
if errorlevel 1 goto fail
supabase functions deploy google-calendar
if errorlevel 1 goto fail

echo.
echo Done. Remember to run supabase/dashboard_cloud.sql in the Supabase SQL Editor.
echo Press any key to close.
pause >nul
exit /b 0

:fail
echo.
echo Supabase deployment stopped. Read the message above, then press any key to close.
pause >nul
exit /b 1
