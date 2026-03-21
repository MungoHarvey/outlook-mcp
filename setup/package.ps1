# =============================================================================
# setup/package.ps1
# Creates a zip of Outlook skills for import into Claude Desktop or Cowork.
# Skill files are rewritten to point to the auth/proxy in $InstallDir.
#
# Zip structure:
#   outlook-skills/
#     SKILLS.md               -- overview and usage guide
#     outlook-auth/           -- skill folders at root level
#     outlook-base/
#     outlook-email-list/
#     ... (all skill folders)
#
# Usage:
#   .\setup\package.ps1
#
# Override default path (used for rewriting skill file paths):
#   .\setup\package.ps1 -InstallDir "D:\tools\outlook-mcp"
# =============================================================================

param(
    [string]$InstallDir = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir

# Default: bake paths pointing to this repo (developer workflow, machine-specific).
if (-not $InstallDir) { $InstallDir = $RootDir }

$PkgName   = "outlook-skills"
$Output    = Join-Path $RootDir "$PkgName.zip"
$Tmp       = Join-Path $env:TEMP "outlook-skills-pkg-$([System.Guid]::NewGuid().ToString('N'))"
$PkgDir    = Join-Path $Tmp $PkgName

New-Item -ItemType Directory -Force -Path $PkgDir | Out-Null

# Forward-slash paths for use inside .md file content
$ProxyPath = ($InstallDir + "\scripts\graph_call.py") -replace '\\', '/'
$AuthPath  = ($InstallDir + "\outlook-skills\auth.sh") -replace '\\', '/'

Write-Host "Packaging Outlook skills..."
Write-Host "  Output:    $Output"
Write-Host "  Auth path: $InstallDir"
Write-Host ""

# -- SKILLS.md overview -------------------------------------------------------
Copy-Item -Force "$ScriptDir\SKILLS.md" "$PkgDir\SKILLS.md"

# -- Skill folders (flat -- no .claude/skills/ nesting) ----------------------
Get-ChildItem "$RootDir\.claude\skills" -Directory |
    Where-Object { $_.Name -like "outlook-*" } |
    ForEach-Object {
        $dest = Join-Path $PkgDir $_.Name
        Copy-Item -Recurse -Force $_.FullName $dest
        Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
            (Get-Content $_.FullName -Raw).
                Replace('python3 scripts/graph_call.py', "python3 $ProxyPath").
                Replace('bash outlook-skills/auth.sh', "bash $AuthPath") |
            Set-Content $_.FullName -Encoding UTF8 -NoNewline
        }
    }

# -- Create zip ---------------------------------------------------------------
Compress-Archive -Path "$PkgDir" -DestinationPath $Output -Force
Remove-Item -Recurse -Force $Tmp

Write-Host "Created: $(Split-Path -Leaf $Output)"
Write-Host ""
Write-Host "Import into Claude Desktop or Cowork:"
Write-Host "  Settings -> Skills -> Import from zip"
Write-Host ""
Write-Host "Auth must be set up in the repo before importing:"
Write-Host "  bash $AuthPath"
