param(
    [string]$InstallDir = "$env:USERPROFILE\.skills\outlook-mcp",
    [string]$SkillsDir  = "$env:USERPROFILE\.claude\skills"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir

# 1. Create directories
New-Item -ItemType Directory -Force -Path "$InstallDir\scripts", "$InstallDir\outlook-skills", $SkillsDir | Out-Null

# 2. Install Python auth system
Copy-Item -Recurse -Force "$RootDir\outlook-skills\*" "$InstallDir\outlook-skills\"

# 3. Install graph_call.py proxy
Copy-Item -Force "$RootDir\scripts\graph_call.py" "$InstallDir\scripts\graph_call.py"

# 4. Install skill folders — rewrite relative paths to installed locations
$proxy = ($InstallDir + "\scripts\graph_call.py") -replace '\\', '/'
$auth  = ($InstallDir + "\outlook-skills\auth.sh") -replace '\\', '/'

Get-ChildItem "$RootDir\.claude\skills" -Directory | Where-Object { $_.Name -like "outlook-*" } | ForEach-Object {
    $dest = "$SkillsDir\$($_.Name)"
    Copy-Item -Recurse -Force $_.FullName $dest
    Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
        (Get-Content $_.FullName).
            Replace('python3 scripts/graph_call.py', "python3 $proxy").
            Replace('bash outlook-skills/auth.sh', "bash $auth") |
        Set-Content $_.FullName
    }
}

# 5. Bootstrap venv
bash ($InstallDir + "/outlook-skills/auth.sh") --status 2>$null

Write-Host "Outlook skills installed"
Write-Host "  Skills: $SkillsDir\outlook-*"
Write-Host "  Auth:   $InstallDir\outlook-skills"
Write-Host "  Proxy:  $InstallDir\scripts\graph_call.py"
Write-Host ""
Write-Host "Next step: bash $auth"
