# PWA Icons Required

This folder needs three icon files for the PWA:

## Required Icons

1. **pwa-192x192.png** - 192x192 pixels
2. **pwa-512x512.png** - 512x512 pixels  
3. **apple-touch-icon.png** - 180x180 pixels (Apple standard)

## Design Specifications

- **Shape**: Square
- **Background**: Dark indigo (#4338ca) or slate (#1e293b)
- **Text/Icon**: "MM" or "Ministry" in white (#ffffff)
- **Font**: Bold, centered
- **Style**: Clean, modern, matching the app's indigo/slate theme

## How to Create These Icons

### Option 1: Online Tools (Easiest)
1. Use **https://realfavicongenerator.net/** or **https://www.favicon-generator.org/**
2. Upload a simple design or use their text generator
3. Download all sizes

### Option 2: Figma/Canva (Recommended)
1. Create a 512x512 square canvas
2. Fill with #4338ca background
3. Add "MM" text in white, centered, bold
4. Export as PNG at 512x512, 192x192, and 180x180

### Option 3: PowerShell Script (Quick Local)
Run this script in PowerShell to generate simple placeholder icons:

```powershell
Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param($size, $filename)
    
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Background
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(67, 56, 202))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Text
    $font = New-Object System.Drawing.Font("Arial", [int]($size/4), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $graphics.DrawString("MM", $font, $textBrush, $rect, $format)
    
    # Save
    $bitmap.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
}

# Generate icons
Create-Icon 192 "pwa-192x192.png"
Create-Icon 512 "pwa-512x512.png"
Create-Icon 180 "apple-touch-icon.png"

Write-Host "Icons generated successfully!" -ForegroundColor Green
```

Once you have the icon files, simply place them in this `public` folder.
