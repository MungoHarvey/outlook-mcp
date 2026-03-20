# =============================================================================
# setup/package.ps1
# Creates a distributable zip of Outlook skills.
#
# The zip is structured to unzip directly into ~/ — no installer needed:
#   Expand-Archive -Path outlook-skills-YYYYMMDD.zip -DestinationPath $env:USERPROFILE
#   bash $env:USERPROFILE\.skills\outlook-mcp\outlook-skills\auth.sh
#
# Override default install paths via parameters:
#   .\setup\package.ps1 -InstallDirRel ".skills\my-install" -SkillsDirRel ".claude\skills"
# =============================================================================

param(
    [string]$InstallDirRel = ".skills\outlook-mcp",
    [string]$SkillsDirRel  = ".claude\skills"
)

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir    = Split-Path -Parent $ScriptDir
$Version    = Get-Date -Format "yyyyMMdd"
$Output     = Join-Path $RootDir "outlook-skills-$Version.zip"
$Tmp        = Join-Path $env:TEMP "outlook-skills-pkg-$([System.Guid]::NewGuid().ToString('N'))"

# Absolute paths for path rewriting inside skill .md files
$AbsInstall = Join-Path $env:USERPROFILE $InstallDirRel
$AbsSkills  = Join-Path $env:USERPROFILE $SkillsDirRel

# Forward-slash versions for use in .md file content (Python / bash paths)
$ProxyPath = ($AbsInstall + "\scripts\graph_call.py") -replace '\\', '/'
$AuthPath  = ($AbsInstall + "\outlook-skills\auth.sh") -replace '\\', '/'

Write-Host "Packaging Outlook skills..."
Write-Host "  Skills path:  $AbsSkills"
Write-Host "  Auth path:    $AbsInstall"
Write-Host ""

# ── Copy and rewrite skill files ──────────────────────────────────────────────
$SkillsDest = Join-Path $Tmp $SkillsDirRel
New-Item -ItemType Directory -Force -Path $SkillsDest | Out-Null

Get-ChildItem "$RootDir\.claude\skills" -Directory |
    Where-Object { $_.Name -like "outlook-*" } |
    ForEach-Object {
        $dest = Join-Path $SkillsDest $_.Name
        Copy-Item -Recurse -Force $_.FullName $dest
        # Rewrite proxy and auth paths to absolute installed locations
        Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
            (Get-Content $_.FullName).
                Replace('python3 scripts/graph_call.py', "python3 $ProxyPath").
                Replace('bash outlook-skills/auth.sh', "bash $AuthPath") |
            Set-Content $_.FullName
        }
    }

Copy-Item -Recurse -Force "$RootDir\.claude\skills\outlook-references" `
    "$SkillsDest\outlook-references"

# ── Copy auth system and proxy ────────────────────────────────────────────────
$AuthDest = Join-Path $Tmp $InstallDirRel
New-Item -ItemType Directory -Force -Path "$AuthDest\outlook-skills", "$AuthDest\scripts" | Out-Null

# Copy auth files, skipping venv and pycache
Get-ChildItem "$RootDir\outlook-skills" |
    Where-Object { $_.Name -notin @('.venv', '__pycache__') } |
    ForEach-Object {
        Copy-Item -Recurse -Force $_.FullName "$AuthDest\outlook-skills\"
    }

Copy-Item -Force "$RootDir\scripts\graph_call.py" "$AuthDest\scripts\graph_call.py"

# ── Create zip ────────────────────────────────────────────────────────────────
Compress-Archive -Path "$Tmp\*" -DestinationPath $Output -Force
Remove-Item -Recurse -Force $Tmp

$ZipName = Split-Path -Leaf $Output
Write-Host "Created: $ZipName"
Write-Host ""
Write-Host "To install, run:"
Write-Host "  Expand-Archive -Path '$ZipName' -DestinationPath `$env:USERPROFILE"
Write-Host "  bash `$env:USERPROFILE\.skills\outlook-mcp\outlook-skills\auth.sh"
Write-Host ""
Write-Host "Then in Claude Desktop or Claude Code, type:"
Write-Host "  /outlook-email-list"
