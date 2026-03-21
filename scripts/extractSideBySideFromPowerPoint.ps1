param(
    [Parameter(Mandatory = $true)]
    [string]$InputRoot,

    [string]$OutputJson = (Join-Path $PSScriptRoot '..\reports\hymns-side-by-side.json'),

    [switch]$IncludeAutosaved
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Text {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ''
    }

    $text = $Value -replace "`r", ''
    $lines = @()

    foreach ($line in ($text -split "`n")) {
        $trimmed = $line.Trim()
        if ($trimmed) {
            $lines += $trimmed
        }
    }

    return ($lines -join "`n").Trim()
}

function Get-SlideTextBlocks {
    param($Slide)

    $blocks = @()

    foreach ($shape in $Slide.Shapes) {
        try {
            if (-not $shape.HasTextFrame) {
                continue
            }

            if (-not $shape.TextFrame.HasText) {
                continue
            }

            $rawText = [string]$shape.TextFrame.TextRange.Text
            $text = Normalize-Text -Value $rawText
            if (-not $text) {
                continue
            }

            $blocks += [PSCustomObject]@{
                Left = [double]$shape.Left
                Top  = [double]$shape.Top
                Text = $text
            }
        }
        catch {
            continue
        }
    }

    return $blocks | Sort-Object Top, Left
}

function Guess-SideLanguage {
    param(
        [string]$Text,
        [string]$Fallback = 'Unknown'
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $Fallback
    }

    $sample = (($Text -split "`n") | Select-Object -First 25) -join ' '

    if ($sample -match 'CAN\s*\(F\)|\bCAN\b|CANTICLES_FANTE|[ɛƐɔƆŋŊ]') {
        return 'Akan'
    }

    if ($sample -match '\bMHB\b|\bHYMN\b|\bTHE\b|\bLORD\b|\bGOD\b') {
        return 'English'
    }

    return $Fallback
}

function Build-OutputRecord {
    param(
        [System.IO.FileInfo]$File,
        [string[]]$LeftLines,
        [string[]]$RightLines
    )

    $rangeGroup = Split-Path -Path $File.DirectoryName -Leaf
    $isCanticle = $rangeGroup -match 'CANTICLES|CREEDS'

    $stem = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    $numberMatch = [regex]::Match($stem, '\d+')
    $number = $null
    if ($numberMatch.Success) {
        $number = [int]$numberMatch.Value
    }

    $leftText = (($LeftLines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n").Trim()
    $rightText = (($RightLines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n").Trim()

    $leftLanguage = Guess-SideLanguage -Text $leftText -Fallback 'Akan'
    $rightFallback = 'Akan'
    if ($leftLanguage -eq 'Akan') {
        $rightFallback = 'English'
    }
    $rightLanguage = Guess-SideLanguage -Text $rightText -Fallback $rightFallback

    $akanText = ''
    $englishText = ''

    if ($leftLanguage -eq 'Akan') { $akanText = $leftText }
    if ($rightLanguage -eq 'Akan' -and -not $akanText) { $akanText = $rightText }

    if ($leftLanguage -eq 'English') { $englishText = $leftText }
    if ($rightLanguage -eq 'English' -and -not $englishText) { $englishText = $rightText }

    $titleSource = if ($rightText) { $rightText } elseif ($leftText) { $leftText } else { $stem }
    $titleLines = $titleSource -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $firstTitleLine = $titleLines | Where-Object {
        $_ -notmatch '^(MHB|CAN|CANTICLE|CANTICLES|SBS)\b' -and $_ -notmatch '^\d+[\.)]?$'
    } | Select-Object -First 1

    if (-not $firstTitleLine) {
        $firstTitleLine = $titleLines | Select-Object -First 1
    }

    if ($firstTitleLine) {
        $firstTitleLine = $firstTitleLine -replace '^\d+[\.)\-:\s]*', ''
    }

    $collection = if ($isCanticle) { 'SIDE_BY_SIDE_CANTICLES' } else { 'SIDE_BY_SIDE_HYMNS' }

    $code = ''
    if ($null -ne $number) {
        $code = if ($isCanticle) { "SBSC$number" } else { "SBS$number" }
    }
    else {
        $code = "SBS-$stem"
    }

    $idSuffix = if ($null -ne $number) { [string]$number } else { $stem }
    $idPrefix = if ($isCanticle) { 'SBS-CANT' } else { 'SBS-HYMN' }

    return [PSCustomObject]@{
        id             = "$idPrefix-$idSuffix"
        collection     = $collection
        code           = $code
        number         = $number
        title          = if ($firstTitleLine) { $firstTitleLine.Trim() } else { $stem }
        lyrics_left    = $leftText
        lyrics_right   = $rightText
        lyrics         = ("[LEFT]`n{0}`n`n[RIGHT]`n{1}" -f $leftText, $rightText).Trim()
        lyrics_akan    = $akanText
        lyrics_english = $englishText
        language_left  = $leftLanguage
        language_right = $rightLanguage
        source_group   = $rangeGroup
        source_path    = $File.FullName
    }
}

if (-not (Test-Path -LiteralPath $InputRoot)) {
    throw "InputRoot not found: $InputRoot"
}

$files = @(Get-ChildItem -LiteralPath $InputRoot -Recurse -File | Where-Object {
    $_.Extension -in '.ppt', '.pptx' -and $_.Name -notmatch '^~\$'
})

if (-not $IncludeAutosaved) {
    $files = @($files | Where-Object { $_.Name -notmatch '\[Autosaved\]' })
}

$files = @($files | Sort-Object FullName)

if (-not $files -or $files.Count -eq 0) {
    throw "No .ppt/.pptx files found under: $InputRoot"
}

Write-Host "Found $($files.Count) PowerPoint files. Starting extraction..." -ForegroundColor Cyan

$records = New-Object System.Collections.Generic.List[object]
$errors = New-Object System.Collections.Generic.List[object]
$powerPoint = $null

try {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    try {
        $powerPoint.Visible = -1
    }
    catch {
        # Some Office installations do not allow toggling visibility; continue.
    }
}
catch {
    throw "Could not start PowerPoint COM automation. Ensure Microsoft PowerPoint is installed. Error: $($_.Exception.Message)"
}

foreach ($file in $files) {
    $presentation = $null

    try {
        $presentation = $powerPoint.Presentations.Open($file.FullName, $true, $false, $true)
        $slideWidth = [double]$presentation.PageSetup.SlideWidth
        $midPoint = $slideWidth / 2

        $leftLines = New-Object System.Collections.Generic.List[string]
        $rightLines = New-Object System.Collections.Generic.List[string]

        foreach ($slide in $presentation.Slides) {
            $blocks = Get-SlideTextBlocks -Slide $slide
            foreach ($block in $blocks) {
                if ($block.Left -lt $midPoint) {
                    $leftLines.Add($block.Text)
                }
                else {
                    $rightLines.Add($block.Text)
                }
            }
        }

        $record = Build-OutputRecord -File $file -LeftLines $leftLines.ToArray() -RightLines $rightLines.ToArray()
        $records.Add($record)

        Write-Host ("Parsed: {0}" -f $file.FullName)
    }
    catch {
        $errors.Add([PSCustomObject]@{
            file  = $file.FullName
            error = $_.Exception.Message
        })
        Write-Warning ("Failed: {0}`n{1}" -f $file.FullName, $_.Exception.Message)
    }
    finally {
        if ($presentation -ne $null) {
            try {
                $presentation.Close()
            }
            catch {
                # ignore close errors
            }
        }
    }
}

if ($powerPoint -ne $null) {
    try {
        $powerPoint.Quit()
    }
    catch {
        # ignore quit errors
    }

    try {
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
    }
    catch {
        # ignore release errors
    }
}

[GC]::Collect()
[GC]::WaitForPendingFinalizers()

$outputPath = [System.IO.Path]::GetFullPath($OutputJson)
$outputDir = Split-Path -Path $outputPath -Parent

if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

$records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding UTF8

if ($errors.Count -gt 0) {
    $errorPath = [System.IO.Path]::ChangeExtension($outputPath, '.errors.json')
    $errors | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $errorPath -Encoding UTF8
    Write-Warning "Completed with $($errors.Count) file errors. See: $errorPath"
}

Write-Host "Done. Wrote $($records.Count) records to $outputPath" -ForegroundColor Green
