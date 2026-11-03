Pod::Spec.new do |s|
  s.name           = 'BibleAudioDownloads'
  s.version        = '1.0.0'
  s.summary        = 'Downloads Bible audio while the iPhone is locked, on Wi-Fi only unless allowed'
  s.description    = 'Background URLSessions for offline Bible audio (#611). Custom until Expo can do it (#612).'
  s.author         = ''
  s.homepage       = 'https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
