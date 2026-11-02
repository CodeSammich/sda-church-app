Pod::Spec.new do |s|
  s.name           = 'BackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Keeps files the app can download again out of iPhone backups'
  s.description    = 'Sets isExcludedFromBackup on downloaded Bible audio (#556).'
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
