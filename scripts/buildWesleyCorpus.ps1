$ErrorActionPreference = 'Stop'

$outFile = Join-Path $PSScriptRoot '..\public\wesley\sermons.json'

$sermons = @(
  @{ number = 1; title = 'Salvation by Faith'; scripture = 'Ephesians 2:8'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.i.html' },
  @{ number = 2; title = 'The Almost Christian'; scripture = 'Acts 26:28'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.ii.html' },
  @{ number = 3; title = 'Awake, Thou That Sleepest'; scripture = 'Ephesians 5:14'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.iii.html' },
  @{ number = 4; title = 'Scriptural Christianity'; scripture = 'Acts 4:31'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.iv.html' },
  @{ number = 5; title = 'Justification by Faith'; scripture = 'Romans 4:5'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.v.html' },
  @{ number = 6; title = 'The Righteousness of Faith'; scripture = 'Romans 10:5-8'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.vi.html' },
  @{ number = 7; title = 'The Way to the Kingdom'; scripture = 'Mark 1:15'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.vii.html' },
  @{ number = 8; title = 'The First-Fruits of the Spirit'; scripture = 'Romans 8:1'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.viii.html' },
  @{ number = 9; title = 'The Spirit of Bondage and of Adoption'; scripture = 'Romans 8:15'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.ix.html' },
  @{ number = 10; title = 'The Witness of the Spirit, Discourse I'; scripture = 'Romans 8:16'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.x.html' },
  @{ number = 11; title = 'The Witness of the Spirit, Discourse II'; scripture = 'Romans 8:16'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xi.html' },
  @{ number = 12; title = 'The Witness of Our Own Spirit'; scripture = '2 Corinthians 1:12'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xii.html' },
  @{ number = 13; title = 'On Sin in Believers'; scripture = '2 Corinthians 5:17'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xiii.html' },
  @{ number = 14; title = 'The Repentance of Believers'; scripture = 'Mark 1:15'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xiv.html' },
  @{ number = 15; title = 'The Great Assize'; scripture = 'Romans 14:10'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xv.html' },
  @{ number = 16; title = 'The Means of Grace'; scripture = 'Malachi 3:7'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xvi.html' },
  @{ number = 17; title = 'The Circumcision of the Heart'; scripture = 'Romans 2:29'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xvii.html' },
  @{ number = 18; title = 'The Marks of the New Birth'; scripture = 'John 3:8'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xviii.html' },
  @{ number = 19; title = 'The Great Privilege of those that are Born of God'; scripture = '1 John 3:9'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xix.html' },
  @{ number = 20; title = 'The Lord Our Righteousness'; scripture = 'Jeremiah 23:6'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xx.html' },
  @{ number = 21; title = 'Upon Our Lord''s Sermon on the Mount, I'; scripture = 'Matthew 5:1-4'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxi.html' },
  @{ number = 22; title = 'Upon Our Lord''s Sermon on the Mount, II'; scripture = 'Matthew 5:5-7'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxii.html' },
  @{ number = 23; title = 'Upon Our Lord''s Sermon on the Mount, III'; scripture = 'Matthew 5:8-12'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxiii.html' },
  @{ number = 24; title = 'Upon Our Lord''s Sermon on the Mount, IV'; scripture = 'Matthew 5:13-16'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxiv.html' },
  @{ number = 25; title = 'Upon Our Lord''s Sermon on the Mount, V'; scripture = 'Matthew 5:17-20'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxv.html' },
  @{ number = 26; title = 'Upon Our Lord''s Sermon on the Mount, VI'; scripture = 'Matthew 6:1-15'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxvi.html' },
  @{ number = 27; title = 'Upon Our Lord''s Sermon on the Mount, VII'; scripture = 'Matthew 6:16-18'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxvii.html' },
  @{ number = 28; title = 'Upon Our Lord''s Sermon on the Mount, VIII'; scripture = 'Matthew 6:19-23'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxviii.html' },
  @{ number = 29; title = 'Upon Our Lord''s Sermon on the Mount, IX'; scripture = 'Matthew 6:24-34'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxix.html' },
  @{ number = 30; title = 'Upon Our Lord''s Sermon on the Mount, X'; scripture = 'Matthew 7:1-12'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxx.html' },
  @{ number = 31; title = 'Upon Our Lord''s Sermon on the Mount, XI'; scripture = 'Matthew 7:13-14'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxi.html' },
  @{ number = 32; title = 'Upon Our Lord''s Sermon on the Mount, XII'; scripture = 'Matthew 7:15-20'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxii.html' },
  @{ number = 33; title = 'Upon Our Lord''s Sermon on the Mount, XIII'; scripture = 'Matthew 7:21-27'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxiii.html' },
  @{ number = 34; title = 'The Original, Nature, Property and Use of the Law'; scripture = 'Romans 7:12'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxiv.html' },
  @{ number = 35; title = 'The Law Established through Faith, Discourse I'; scripture = 'Romans 3:31'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxv.html' },
  @{ number = 36; title = 'The Law Established through Faith, Discourse II'; scripture = 'Romans 3:31'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxvi.html' },
  @{ number = 37; title = 'The Nature of Enthusiasm'; scripture = 'Acts 26:24'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxvii.html' },
  @{ number = 38; title = 'A Caution Against Bigotry'; scripture = 'Mark 9:38-39'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxviii.html' },
  @{ number = 39; title = 'Catholic Spirit'; scripture = '2 Kings 10:15'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xxxix.html' },
  @{ number = 40; title = 'Christian Perfection'; scripture = 'Philippians 3:12'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xl.html' },
  @{ number = 41; title = 'Wandering Thoughts'; scripture = '2 Corinthians 10:5'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xli.html' },
  @{ number = 42; title = 'Satan''s Devices'; scripture = '2 Corinthians 2:11'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xlii.html' },
  @{ number = 43; title = 'The Scripture Way of Salvation'; scripture = 'Ephesians 2:8'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xliii.html' },
  @{ number = 44; title = 'Original Sin'; scripture = 'Genesis 6:5'; url = 'https://ccel.org/ccel/wesley/sermons/sermons.v.xliv.html' }
)

function Get-CleanText {
  param([string]$Html)

  $start = $Html.IndexOf('<div id="theText"')
  $end = $Html.IndexOf('<div id="content-foot"')
  if ($start -lt 0 -or $end -le $start) {
    throw 'Could not locate sermon body in HTML.'
  }

  $content = $Html.Substring($start, $end - $start)
  $content = [regex]::Replace($content, '<span class="mnote".*?</span>', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $content = [regex]::Replace($content, '<sup class="Note".*?</sup>', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $content = [regex]::Replace($content, '<script.*?</script>', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $content = [regex]::Replace($content, '<style.*?</style>', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $content = [regex]::Replace($content, '<br\s*/?>', "`n", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $content = [regex]::Replace($content, '</(p|div|h1|h2|h3|h4|li|tr|blockquote)>', "`n`n", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $content = [regex]::Replace($content, '<li[^>]*>', '- ', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $content = [regex]::Replace($content, '<td[^>]*>', ' ', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $content = [regex]::Replace($content, '<[^>]+>', '')
  $content = [System.Net.WebUtility]::HtmlDecode($content)
  $content = $content -replace [char]0x00A0, ' '
  $content = $content -replace 'Click here to close the reader', ''
  $content = $content -replace '(?m)^\s*«\s*Prev.*$', ''
  $content = $content -replace '(?m)^\s*Next\s*».*$', ''
  $content = $content -replace '(?m)^\s*Contents\s*$', ''
  $content = $content -replace '(?m)^\s*Previous.*$', ''
  $content = $content -replace '(?m)^\s*Next.*$', ''
  $content = $content -replace '[ \t]+', ' '
  $content = $content -replace '(\r?\n){3,}', "`n`n"
  return $content.Trim()
}

$result = foreach ($sermon in $sermons) {
  Write-Host "Fetching sermon $($sermon.number): $($sermon.title)"
  $html = Invoke-WebRequest -Uri $sermon.url -UseBasicParsing | Select-Object -ExpandProperty Content
  [PSCustomObject]@{
    number = $sermon.number
    title = $sermon.title
    scripture = $sermon.scripture
    source = $sermon.url
    text = Get-CleanText -Html $html
  }
}

$result | ConvertTo-Json -Depth 4 | Set-Content $outFile -Encoding UTF8
Write-Host "Saved $($result.Count) sermons to $outFile"
