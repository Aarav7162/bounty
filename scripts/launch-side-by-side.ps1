<#
.SYNOPSIS
  Launches Bounty Buyer and Seller terminals side-by-side at 640x720 each for OBS screen recording.
#>

param(
  [switch]$WindowsTerminal,
  [int]$PauseSeconds = 2
)

$projectDir = "c:\Users\aarav.SOMEGUYWITHPRET\Bounty"
Set-Location $projectDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  BOUNTY SIDE-BY-SIDE RECORDING ORCHESTRATOR" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check if Broker is online on port 4000
$brokerOnline = $false
try {
  $res = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 2 -ErrorAction Stop
  if ($res.status -eq "ok") { $brokerOnline = $true }
} catch {
  $brokerOnline = $false
}

if (-not $brokerOnline) {
  Write-Host "`n[!] Broker Hub is not running on port 4000." -ForegroundColor Yellow
  Write-Host "    Starting Broker in the background..." -ForegroundColor Gray
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir'; bounty server"
  Start-Sleep -Seconds 3
} else {
  Write-Host "✔ Broker Hub verified online on port 4000." -ForegroundColor Green
}

# 2. Check if Mock Cloudflare Server is online on port 5000
$mockCfOnline = $false
try {
  $null = Invoke-WebRequest -Uri "http://localhost:5000/protected" -TimeoutSec 2 -ErrorAction Stop
  $mockCfOnline = $true
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) {
    $mockCfOnline = $true
  }
}

if (-not $mockCfOnline) {
  Write-Host "    Starting Mock Cloudflare server on port 5000..." -ForegroundColor Gray
  Start-Process powershell -ArgumentList "-WindowStyle", "Minimized", "-Command", "cd '$projectDir'; npx tsx examples/01-cloudflare-bypass/mock-cf-server.ts"
  Start-Sleep -Seconds 2
  Write-Host "✔ Mock Cloudflare server online on port 5000." -ForegroundColor Green
} else {
  Write-Host "✔ Mock Cloudflare server verified online on port 5000." -ForegroundColor Green
}

Write-Host "`nReady to launch side-by-side terminals (Total Canvas: 1280x720)." -ForegroundColor Cyan

if ($WindowsTerminal) {
  # Option A: Windows Terminal split pane
  Write-Host "Launching Windows Terminal split-pane..." -ForegroundColor White
  $wtArgs = "-w 0 --title `"Bounty Buyer [Left]`" -p `"PowerShell`" -d `"$projectDir`" powershell -NoExit -Command `"Write-Host 'Ready. Running in 3s...'; Start-Sleep -Seconds 3; bounty buy scrape http://localhost:5000/protected --bypass cloudflare_turnstile --pause $PauseSeconds`" `; split-pane -V -p `"PowerShell`" -d `"$projectDir`" powershell -NoExit -Command `"bounty sell`""
  Start-Process wt.exe -ArgumentList $wtArgs
} else {
  # Option B: Two separate windows sized and positioned at exactly 640x720 side-by-side
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinUtil {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@

  Write-Host "1. Launching Seller Node in Right Window (X: 640, Y: 0, Width: 640, Height: 720)..." -ForegroundColor Yellow
  $sellerScript = "cd '$projectDir'; `$Host.UI.RawUI.WindowTitle = 'Bounty Seller Node [Right]'; bounty sell"
  $sellerProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $sellerScript -PassThru
  
  # Wait for window handle
  Start-Sleep -Milliseconds 800
  $sellerProc.Refresh()
  $retries = 0
  while ($sellerProc.MainWindowHandle -eq [IntPtr]::Zero -and $retries -lt 20) {
    Start-Sleep -Milliseconds 200
    $sellerProc.Refresh()
    $retries++
  }
  if ($sellerProc.MainWindowHandle -ne [IntPtr]::Zero) {
    [WinUtil]::MoveWindow($sellerProc.MainWindowHandle, 640, 0, 640, 720, $true) | Out-Null
  }

  Write-Host "   Waiting 3 seconds for Seller Node to connect to Broker orderbook..." -ForegroundColor Gray
  Start-Sleep -Seconds 3

  Write-Host "2. Launching Buyer Agent in Left Window (X: 0, Y: 0, Width: 640, Height: 720)..." -ForegroundColor Yellow
  $buyerScript = "cd '$projectDir'; `$Host.UI.RawUI.WindowTitle = 'Bounty Buyer Agent [Left]'; Write-Host 'Broadcasting RFP with 2s pacing between steps...'; Start-Sleep -Seconds 1; bounty buy scrape http://localhost:5000/protected --bypass cloudflare_turnstile --pause $PauseSeconds"
  $buyerProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", $buyerScript -PassThru
  
  Start-Sleep -Milliseconds 800
  $buyerProc.Refresh()
  $retries = 0
  while ($buyerProc.MainWindowHandle -eq [IntPtr]::Zero -and $retries -lt 20) {
    Start-Sleep -Milliseconds 200
    $buyerProc.Refresh()
    $retries++
  }
  if ($buyerProc.MainWindowHandle -ne [IntPtr]::Zero) {
    [WinUtil]::MoveWindow($buyerProc.MainWindowHandle, 0, 0, 640, 720, $true) | Out-Null
    [WinUtil]::SetForegroundWindow($buyerProc.MainWindowHandle) | Out-Null
  }
}

Write-Host "`n✔ Side-by-side terminals launched successfully!" -ForegroundColor Green
Write-Host "  Left Window (0,0,640,720):   Buyer Agent delegating Turnstile bypass" -ForegroundColor White
Write-Host "  Right Window (640,0,640,720): Seller Node receiving task & earning PayPal payout" -ForegroundColor White
Write-Host "`nOBS Recording Region: 1280 x 720 starting at Top-Left (0, 0)." -ForegroundColor Cyan

