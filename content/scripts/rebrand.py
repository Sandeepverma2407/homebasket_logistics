#!/usr/bin/env python3
"""
=============================================================================
MTB Store / Delivery Partner App Rebranding CLI Tool
=============================================================================
Automates white-label rebranding across the entire Delivery App:
 1. Updates PROJECT_NAME & APP_NAME in constant.ts and Backend/connection/config.php.
 2. Updates Android package_name / applicationId / namespace everywhere.
 3. Relocates Android Kotlin files (MainActivity, MainApplication, Notification services, etc.)
    to match the new package directory structure and updates package statements.
 4. Generates multi-density app launcher icons, splash drawables, and notification icons from logo.
 5. Updates app display name, slug, scheme, and permission strings in app.json, strings.xml, AndroidManifest.xml.
 6. Syncs or updates google-services.json with client package_name.
 7. Configures release keystore & signing configuration.
 8. Updates iOS bundle identifier & display name if configured.

Usage:
  npm run rebrand -- --project homebasket --package com.homebasket.delivery --logo homebasket_logo.jpeg --name "HB Logistics" --keystore homebasketdelivery.keystore --key-alias homebasketdelivery
  python3 scripts/rebrand.py --dry-run
=============================================================================
"""

import os
import sys
import re
import json
import shutil
import argparse
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ Error: Pillow is required. Please run: pip3 install Pillow")
    sys.exit(1)

# Color terminal formatting
class Style:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def log_step(title):
    print(f"\n{Style.BOLD}{Style.CYAN}==> {title}{Style.RESET}")

def log_success(msg):
    print(f"  {Style.GREEN}✔{Style.RESET} {msg}")

def log_warn(msg):
    print(f"  {Style.YELLOW}⚠{Style.RESET} {msg}")

def log_info(msg):
    print(f"  {Style.BLUE}ℹ{Style.RESET} {msg}")

# Base directory detection
SCRIPT_DIR = Path(__file__).resolve().parent
CONTENT_DIR = SCRIPT_DIR.parent
DELIVERY_DIR = CONTENT_DIR.parent
APPS_DIR = DELIVERY_DIR.parent
CLIENT_ROOT = APPS_DIR.parent

def find_logo_file(logo_arg):
    """Search for logo file in common locations if not absolute path."""
    candidates = [
        Path(logo_arg),
        DELIVERY_DIR / logo_arg,
        CONTENT_DIR / logo_arg,
        CONTENT_DIR / 'assets' / logo_arg,
        CONTENT_DIR / 'assets/images' / logo_arg,
        APPS_DIR / logo_arg,
        CLIENT_ROOT / logo_arg,
        CONTENT_DIR / 'assets' / 'homebasket_logo.jpeg',
        CONTENT_DIR / 'assets' / 'logo.jpeg',
        DELIVERY_DIR / 'homebasket_logo.jpeg',
    ]
    for c in candidates:
        if c.is_file():
            return c.resolve()
    return None

def find_keystore_file(keystore_arg, project_name):
    """Search for keystore file in common locations if provided or auto-detect."""
    if keystore_arg:
        candidates = [
            Path(keystore_arg),
            DELIVERY_DIR / keystore_arg,
            CONTENT_DIR / keystore_arg,
            CONTENT_DIR / 'android/app' / keystore_arg,
            APPS_DIR / keystore_arg,
            CLIENT_ROOT / keystore_arg,
        ]
        for c in candidates:
            if c.is_file():
                return c.resolve()

    # Auto-detection by project name
    auto_candidates = [
        DELIVERY_DIR / f"{project_name}delivery.keystore",
        DELIVERY_DIR / f"{project_name}.keystore",
        CONTENT_DIR / f"{project_name}delivery.keystore",
        CONTENT_DIR / f"{project_name}.keystore",
        CONTENT_DIR / 'android/app' / f"{project_name}delivery.keystore",
        CONTENT_DIR / 'android/app' / f"{project_name}.keystore",
    ]
    for c in auto_candidates:
        if c.is_file():
            return c.resolve()
    return None

def make_centered_canvas(src_logo, content_bbox, target_w, target_h, content_coverage=0.68, bg_color=(255, 255, 255), mode='RGB'):
    min_x, min_y, max_x, max_y = content_bbox
    content_w = max(1, max_x - min_x)
    content_h = max(1, max_y - min_y)
    content_cx = (min_x + max_x) / 2.0
    content_cy = (min_y + max_y) / 2.0
    
    src_w, src_h = src_logo.size
    target_box = min(target_w, target_h)
    desired_content_w = target_box * content_coverage
    scale = desired_content_w / float(content_w)
    
    scaled_w = max(1, int(round(src_w * scale)))
    scaled_h = max(1, int(round(src_h * scale)))
    scaled_logo = src_logo.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    
    scaled_content_cx = content_cx * scale
    scaled_content_cy = content_cy * scale
    
    dest_cx = target_w / 2.0
    dest_cy = target_h / 2.0
    
    pos_x = int(round(dest_cx - scaled_content_cx))
    pos_y = int(round(dest_cy - scaled_content_cy))
    
    if mode == 'RGBA':
        alpha = 255 if len(bg_color) < 4 else bg_color[3]
        canvas = Image.new('RGBA', (target_w, target_h), (bg_color[0], bg_color[1], bg_color[2], alpha))
        canvas.paste(scaled_logo, (pos_x, pos_y), scaled_logo if scaled_logo.mode == 'RGBA' else None)
    else:
        canvas = Image.new('RGB', (target_w, target_h), (bg_color[0], bg_color[1], bg_color[2]))
        canvas.paste(scaled_logo, (pos_x, pos_y))
    return canvas

def make_round_icon(src_logo, content_bbox, size, content_coverage=0.68):
    hires_size = size * 4
    hires_canvas = make_centered_canvas(src_logo, content_bbox, hires_size, hires_size, content_coverage=content_coverage, bg_color=(255, 255, 255), mode='RGB')
    mask_hires = Image.new('L', (hires_size, hires_size), 0)
    draw = ImageDraw.Draw(mask_hires)
    draw.ellipse((0, 0, hires_size - 1, hires_size - 1), fill=255)
    
    mask = mask_hires.resize((size, size), Image.Resampling.LANCZOS)
    base = hires_canvas.resize((size, size), Image.Resampling.LANCZOS)
    
    round_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    round_img.paste(base, (0, 0), mask)
    return round_img

def generate_all_icons_and_splash(src_logo_path, project_name, dry_run=False):
    log_step(f"Generating Multi-Density Branding Assets from {src_logo_path.name}")
    if dry_run:
        log_info(f"[Dry Run] Would generate assets from {src_logo_path}")
        return

    src_logo = Image.open(src_logo_path).convert('RGB')
    src_w, src_h = src_logo.size
    
    # Calculate non-white bounding box
    min_x, min_y = src_w, src_h
    max_x, max_y = 0, 0
    for y in range(src_h):
        for x in range(src_w):
            r, g, b = src_logo.getpixel((x, y))
            if r < 240 or g < 240 or b < 240:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
    
    if max_x <= min_x or max_y <= min_y:
        bbox = (0, 0, src_w, src_h)
    else:
        bbox = (min_x, min_y, max_x, max_y)

    assets_dir = CONTENT_DIR / 'assets'
    assets_images_dir = assets_dir / 'images'
    assets_dir.mkdir(parents=True, exist_ok=True)
    assets_images_dir.mkdir(parents=True, exist_ok=True)

    # 1. Base assets in assets/
    primary_logo_jpeg = assets_dir / f"{project_name}_logo.jpeg"
    primary_logo_png = assets_dir / f"{project_name}_logo.png"
    primary_logo_webp = assets_dir / f"{project_name}_logo.webp"

    src_logo.save(primary_logo_jpeg, 'JPEG', quality=95)
    src_logo.save(primary_logo_png, 'PNG')
    src_logo.save(primary_logo_webp, 'WEBP', quality=95)

    src_logo.save(assets_dir / f"{project_name}.jpeg", 'JPEG', quality=95)
    src_logo.save(assets_dir / f"{project_name}.png", 'PNG')
    src_logo.save(assets_dir / f"{project_name}.webp", 'WEBP', quality=95)

    src_logo.save(assets_dir / 'logo.jpeg', 'JPEG', quality=95)
    shutil.copy2(primary_logo_png, assets_dir / 'exhome_logo.png')
    shutil.copy2(primary_logo_png, assets_dir / 'logo_icon.png')

    # 2. Base assets in assets/images/
    shutil.copy2(primary_logo_png, assets_images_dir / 'logo.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'icon.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'splash-icon.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'exhome_logo.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'newlogo.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'logo_icon.png')
    shutil.copy2(primary_logo_png, assets_images_dir / 'logo-glow.png')

    # 3. Adaptive Icons
    adaptive_fg = make_centered_canvas(src_logo, bbox, 1024, 1024, content_coverage=0.66, bg_color=(255, 255, 255), mode='RGB')
    adaptive_fg.save(assets_images_dir / 'android-icon-foreground.png', 'PNG')

    bg_img = Image.new('RGB', (512, 512), (255, 255, 255))
    bg_img.save(assets_images_dir / 'android-icon-background.png', 'PNG')

    mono_img = make_centered_canvas(src_logo, bbox, 432, 432, content_coverage=0.66, bg_color=(255, 255, 255), mode='RGB').convert('L')
    mono_img.save(assets_images_dir / 'android-icon-monochrome.png', 'PNG')

    favicon_img = make_centered_canvas(src_logo, bbox, 512, 512, content_coverage=0.85, bg_color=(255, 255, 255), mode='RGB')
    favicon_img.save(assets_images_dir / 'favicon.png', 'PNG')

    # 4. Android Splash and Notifications
    splash_densities = {
        'drawable-mdpi': 288,
        'drawable-hdpi': 432,
        'drawable-xhdpi': 576,
        'drawable-xxhdpi': 864,
        'drawable-xxxhdpi': 1152,
    }
    for folder, dim in splash_densities.items():
        dest = CONTENT_DIR / 'android/app/src/main/res' / folder
        dest.mkdir(parents=True, exist_ok=True)
        splash_img = make_centered_canvas(src_logo, bbox, dim, dim, content_coverage=0.65, bg_color=(255, 255, 255), mode='RGB')
        splash_img.save(dest / 'splashscreen_logo.png', 'PNG')
        notif_img = make_centered_canvas(src_logo, bbox, dim, dim, content_coverage=0.75, bg_color=(255, 255, 255), mode='RGB')
        notif_img.save(dest / 'notification_icon.png', 'PNG')

    # 5. Android Mipmap Launcher Icons
    mipmap_configs = {
        'mipmap-mdpi': {'legacy': 48, 'adaptive': 108},
        'mipmap-hdpi': {'legacy': 72, 'adaptive': 162},
        'mipmap-xhdpi': {'legacy': 96, 'adaptive': 216},
        'mipmap-xxhdpi': {'legacy': 144, 'adaptive': 324},
        'mipmap-xxxhdpi': {'legacy': 192, 'adaptive': 432},
    }
    for folder, cfg in mipmap_configs.items():
        dest = CONTENT_DIR / 'android/app/src/main/res' / folder
        dest.mkdir(parents=True, exist_ok=True)
        leg_dim = cfg['legacy']
        adap_dim = cfg['adaptive']

        ic_launcher = make_centered_canvas(src_logo, bbox, leg_dim, leg_dim, content_coverage=0.78, bg_color=(255, 255, 255), mode='RGB')
        ic_launcher.save(dest / 'ic_launcher.webp', 'WEBP', quality=95)

        ic_launcher_round = make_round_icon(src_logo, bbox, leg_dim, content_coverage=0.68)
        ic_launcher_round.save(dest / 'ic_launcher_round.webp', 'WEBP', quality=95)

        ic_fg = make_centered_canvas(src_logo, bbox, adap_dim, adap_dim, content_coverage=0.66, bg_color=(255, 255, 255), mode='RGB')
        ic_fg.save(dest / 'ic_launcher_foreground.webp', 'WEBP', quality=95)

        ic_bg = Image.new('RGB', (adap_dim, adap_dim), (255, 255, 255))
        ic_bg.save(dest / 'ic_launcher_background.webp', 'WEBP', quality=95)

        ic_mono = ic_fg.convert('L').convert('RGB')
        ic_mono.save(dest / 'ic_launcher_monochrome.webp', 'WEBP', quality=95)

    log_success(f"Generated all icons and splash assets for '{project_name}'")

def update_file_regex(path, replacements, dry_run=False):
    """Safely replace regex patterns in a file."""
    if not path.is_file():
        log_warn(f"File not found: {path}")
        return False

    content = path.read_text(encoding='utf-8')
    modified = content
    for pattern, repl in replacements:
        modified = re.sub(pattern, repl, modified)

    if modified != content:
        rel = path.relative_to(DELIVERY_DIR) if path.is_relative_to(DELIVERY_DIR) else path.name
        if dry_run:
            log_info(f"[Dry Run] Would update {rel}")
        else:
            path.write_text(modified, encoding='utf-8')
            log_success(f"Updated {rel}")
        return True
    return False

def migrate_android_kotlin_files(new_package, dry_run=False):
    """Move Kotlin / Java files to matching directory and update package declaration."""
    log_step("Migrating Android Kotlin Package Structure")
    java_root = CONTENT_DIR / 'android/app/src/main/java'
    
    # Locate existing MainActivity.kt
    existing_files = list(java_root.glob('**/MainActivity.kt'))
    if not existing_files:
        log_warn("Could not find MainActivity.kt")
        return

    old_main_activity = existing_files[0]
    old_package_dir = old_main_activity.parent
    
    # Read old package
    old_pkg_line = old_main_activity.read_text(encoding='utf-8').splitlines()[0]
    m = re.match(r'package\s+([\w\.]+)', old_pkg_line)
    old_pkg = m.group(1) if m else 'unknown'
    log_info(f"Detected existing Android package: {old_pkg}")

    new_pkg_path = java_root.joinpath(*new_package.split('.'))
    
    if dry_run:
        log_info(f"[Dry Run] Would move Kotlin files from {old_package_dir} to {new_pkg_path}")
        return

    source_files = list(old_package_dir.glob('*.kt')) + list(old_package_dir.glob('*.java'))

    if old_package_dir.resolve() == new_pkg_path.resolve():
        for sf in source_files:
            content = sf.read_text(encoding='utf-8')
            new_content = re.sub(r'package\s+[\w\.]+', f'package {new_package}', content, count=1)
            if new_content != content:
                sf.write_text(new_content, encoding='utf-8')
                log_success(f"Updated package declaration in {sf.name}")
            else:
                log_info(f"{sf.name} is already in target package directory")
        return

    new_pkg_path.mkdir(parents=True, exist_ok=True)

    for sf in source_files:
        content = sf.read_text(encoding='utf-8')
        content = re.sub(r'package\s+[\w\.]+', f'package {new_package}', content, count=1)
        dest_file = new_pkg_path / sf.name
        dest_file.write_text(content, encoding='utf-8')
        log_success(f"Moved & updated {sf.name} -> {new_package}")
        sf.unlink()

    # Clean up empty old directory tree
    try:
        curr = old_package_dir
        while curr != java_root:
            if not any(curr.iterdir()):
                curr.rmdir()
                curr = curr.parent
            else:
                break
    except Exception:
        pass

def sync_google_services(new_package, dry_run=False):
    """Sync google-services.json from root or update package_name in delivery app."""
    log_step("Updating Google Services (Firebase) Configuration")
    candidates = [
        CONTENT_DIR / 'google-services.json',
        DELIVERY_DIR / 'google-services.json',
        APPS_DIR / 'google-services.json',
        CLIENT_ROOT / 'google-services.json',
    ]
    
    source_gs = None
    for cand in candidates:
        if cand.is_file():
            source_gs = cand
            break

    target_files = [
        CONTENT_DIR / 'google-services.json',
        CONTENT_DIR / 'android/app/google-services.json'
    ]

    if source_gs and source_gs.is_file():
        if dry_run:
            log_info(f"[Dry Run] Would sync {source_gs} to android/app")
        else:
            for tf in target_files:
                if source_gs.resolve() != tf.resolve():
                    shutil.copy2(source_gs, tf)
                    log_success(f"Synced {source_gs.name} to {tf.relative_to(DELIVERY_DIR)}")

    for gs_path in target_files:
        if gs_path.is_file():
            try:
                data = json.loads(gs_path.read_text(encoding='utf-8'))
                clients = data.get('client', [])
                found = False
                for c in clients:
                    pkg = c.get('client_info', {}).get('android_client_info', {}).get('package_name')
                    if pkg == new_package:
                        found = True
                        break
                if not found and clients:
                    # Update existing delivery package entry
                    for c in clients:
                        pkg = c.get('client_info', {}).get('android_client_info', {}).get('package_name', '')
                        if 'delivery' in pkg:
                            c['client_info']['android_client_info']['package_name'] = new_package
                            found = True
                            break
                    if not found:
                        clients[0]['client_info']['android_client_info']['package_name'] = new_package
                if not dry_run:
                    gs_path.write_text(json.dumps(data, indent=2), encoding='utf-8')
                    log_success(f"Configured package_name '{new_package}' in {gs_path.name}")
            except Exception as err:
                log_warn(f"Could not parse {gs_path}: {err}")

def update_keystore_config(keystore_path, key_alias=None, dry_run=False):
    """Copy keystore into android/app/ and update gradle.properties and build.gradle."""
    if not keystore_path or not keystore_path.is_file():
        return

    log_step(f"Configuring Android Release Keystore ({keystore_path.name})")
    dest_keystore = CONTENT_DIR / 'android/app' / keystore_path.name
    
    if not key_alias:
        key_alias = keystore_path.stem

    if dry_run:
        log_info(f"[Dry Run] Would copy keystore to {dest_keystore}")
        log_info(f"[Dry Run] Would configure keyAlias '{key_alias}' and file '{keystore_path.name}'")
        return

    if keystore_path.resolve() != dest_keystore.resolve():
        shutil.copy2(keystore_path, dest_keystore)
        log_success(f"Copied {keystore_path.name} to {dest_keystore.relative_to(DELIVERY_DIR)}")
    else:
        log_info(f"Keystore {keystore_path.name} is already in android/app/")

    # Update gradle.properties
    gradle_props = CONTENT_DIR / 'android/gradle.properties'
    update_file_regex(gradle_props, [
        (r'MYAPP_RELEASE_STORE_FILE=.*', f'MYAPP_RELEASE_STORE_FILE={keystore_path.name}'),
        (r'MYAPP_RELEASE_KEY_ALIAS=.*', f'MYAPP_RELEASE_KEY_ALIAS={key_alias}'),
    ], dry_run=dry_run)

    # Update build.gradle
    build_gradle = CONTENT_DIR / 'android/app/build.gradle'
    update_file_regex(build_gradle, [
        (r"storeFile file\('.*?\.keystore'\)", f"storeFile file('{keystore_path.name}')"),
        (r"keyAlias '.*?'", f"keyAlias '{key_alias}'"),
    ], dry_run=dry_run)

    log_success(f"Configured release keystore '{keystore_path.name}' with alias '{key_alias}'")

def run_rebrand(project_name, package_name, logo_path, app_name, keystore_path=None, key_alias=None, dry_run=False):
    print(f"\n{Style.HEADER}{Style.BOLD}🚀 MTB STORE / DELIVERY APP REBRANDING AUTOMATION{Style.RESET}")
    print(f"{Style.BOLD}------------------------------------------------------------{Style.RESET}")
    print(f"  • Project Slug  : {Style.BOLD}{project_name}{Style.RESET}")
    print(f"  • Package Name  : {Style.BOLD}{package_name}{Style.RESET}")
    print(f"  • App Name      : {Style.BOLD}{app_name}{Style.RESET}")
    print(f"  • Logo Source   : {Style.BOLD}{logo_path}{Style.RESET}")
    if keystore_path:
        print(f"  • Keystore File : {Style.BOLD}{keystore_path.name}{Style.RESET} (alias: {key_alias or keystore_path.stem})")
    print(f"  • Dry Run       : {Style.YELLOW}{dry_run}{Style.RESET}")
    print(f"{Style.BOLD}------------------------------------------------------------{Style.RESET}\n")

    # 1. Generate multi-density icons and splash drawables
    generate_all_icons_and_splash(logo_path, project_name, dry_run=dry_run)

    # 2. Update TypeScript Delivery Constants: content/src/constants/constant.ts
    log_step("Updating TypeScript Delivery Constants")
    constant_ts = CONTENT_DIR / 'src/constants/constant.ts'
    update_file_regex(constant_ts, [
        (r"export const PROJECT_NAME = '.*?';", f"export const PROJECT_NAME = '{project_name}';"),
        (r"export const APP_NAME = '.*?';", f"export const APP_NAME = '{app_name}';"),
    ], dry_run=dry_run)

    # 3. Update PHP Backend Config: Backend/connection/config.php
    log_step("Updating PHP Backend Configuration")
    config_php = DELIVERY_DIR / 'Backend/connection/config.php'
    update_file_regex(config_php, [
        (r"\$project_name\s*=\s*'.*?';", f"$project_name = '{project_name}';"),
        (r"define\('PROJECT_NAME',\s*'.*?'\);", f"define('PROJECT_NAME', '{project_name}');"),
        (r"define\('APP_NAME',\s*'.*?'\);", f"define('APP_NAME', '{app_name.upper()}');"),
    ], dry_run=dry_run)

    # 4. Update Expo app.json
    log_step("Updating Expo app.json")
    app_json_path = CONTENT_DIR / 'app.json'
    if app_json_path.is_file():
        app_json_content = app_json_path.read_text(encoding='utf-8')
        app_json_content = re.sub(r'"name":\s*".*?"', f'"name": "{app_name}"', app_json_content)
        app_json_content = re.sub(r'"slug":\s*".*?"', f'"slug": "{project_name}"', app_json_content)
        app_json_content = re.sub(r'"bundleIdentifier":\s*".*?"', f'"bundleIdentifier": "{package_name}"', app_json_content)
        app_json_content = re.sub(r'"package":\s*".*?"', f'"package": "{package_name}"', app_json_content)
        app_json_content = re.sub(r'"scheme":\s*".*?"', f'"scheme": "{project_name}delivery"', app_json_content)
        app_json_content = re.sub(r'"NSLocationWhenInUseUsageDescription":\s*".*?"', f'"NSLocationWhenInUseUsageDescription": "{app_name} needs your location to assign nearby delivery jobs."', app_json_content)
        app_json_content = re.sub(r'"NSLocationAlwaysAndWhenInUseUsageDescription":\s*".*?"', f'"NSLocationAlwaysAndWhenInUseUsageDescription": "{app_name} needs your location to assign nearby delivery jobs even in the background."', app_json_content)
        app_json_content = re.sub(r'"locationWhenInUsePermission":\s*".*?"', f'"locationWhenInUsePermission": "{app_name} needs your location to assign nearby delivery jobs."', app_json_content)
        if dry_run:
            log_info("[Dry Run] Would update app.json")
        else:
            app_json_path.write_text(app_json_content, encoding='utf-8')
            log_success("Updated app.json configuration")

    # 5. Update react-native.config.js
    log_step("Updating react-native.config.js")
    rn_config = CONTENT_DIR / 'react-native.config.js'
    update_file_regex(rn_config, [
        (r"packageName:\s*['\"].*?['\"]", f"packageName: '{package_name}'"),
    ], dry_run=dry_run)

    # 6. Update Android build.gradle
    log_step("Updating Android build.gradle")
    build_gradle = CONTENT_DIR / 'android/app/build.gradle'
    update_file_regex(build_gradle, [
        (r"namespace\s+['\"].*?['\"]", f"namespace '{package_name}'"),
        (r"applicationId\s+['\"].*?['\"]", f"applicationId '{package_name}'"),
    ], dry_run=dry_run)

    # 7. Update Android strings.xml
    log_step("Updating Android strings.xml")
    strings_xml = CONTENT_DIR / 'android/app/src/main/res/values/strings.xml'
    update_file_regex(strings_xml, [
        (r'<string name="app_name">.*?</string>', f'<string name="app_name">{app_name}</string>'),
    ], dry_run=dry_run)

    # 8. Update Android settings.gradle
    log_step("Updating Android settings.gradle")
    settings_gradle = CONTENT_DIR / 'android/settings.gradle'
    update_file_regex(settings_gradle, [
        (r"rootProject\.name\s*=\s*['\"].*?['\"]", f"rootProject.name = '{app_name}'"),
    ], dry_run=dry_run)

    # 9. Update AndroidManifest.xml deep link scheme (preserving https scheme in queries)
    log_step("Updating AndroidManifest.xml Deep Link Scheme")
    manifest_xml = CONTENT_DIR / 'android/app/src/main/AndroidManifest.xml'
    update_file_regex(manifest_xml, [
        (r'<data android:scheme="(?!https?")[^"]*?"\s*/>', f'<data android:scheme="{project_name}delivery"/>'),
    ], dry_run=dry_run)

    # 10. Relocate Kotlin source files to new package
    migrate_android_kotlin_files(package_name, dry_run=dry_run)

    # 11. Update Google Services / Firebase
    sync_google_services(package_name, dry_run=dry_run)

    # 12. Update Keystore & Signing Configuration
    if keystore_path:
        update_keystore_config(keystore_path, key_alias=key_alias, dry_run=dry_run)

    # 13. Update UI Branding Strings
    log_step("Updating UI Branding Strings")
    settings_tsx = CONTENT_DIR / 'src/app/settings.tsx'
    update_file_regex(settings_tsx, [
        (r"log out of your .*? partner account", f"log out of your {app_name} partner account"),
    ], dry_run=dry_run)

    complete_tsx = CONTENT_DIR / 'src/app/complete.tsx'
    update_file_regex(complete_tsx, [
        (r"in their Mtb app", f"in their {app_name} app"),
    ], dry_run=dry_run)

    mock_interceptor = CONTENT_DIR / 'src/mock/mockInterceptor.ts'
    update_file_regex(mock_interceptor, [
        (r"\[.*?\] Mock Data Interceptor", f"[{app_name}] Mock Data Interceptor"),
    ], dry_run=dry_run)

    support_modal = CONTENT_DIR / 'src/components/HelpSupportModal.tsx'
    update_file_regex(support_modal, [
        (r"support@\w+\.com", f"support@{project_name}.com"),
    ], dry_run=dry_run)

    # 14. Update iOS files if present
    info_plist = CONTENT_DIR / 'ios/Express24Delivery/Info.plist'
    if info_plist.is_file():
        log_step("Updating iOS Info.plist")
        update_file_regex(info_plist, [
            (r'(<key>CFBundleDisplayName</key>\s*<string>).*?(</string>)', rf'\g<1>{app_name}\2'),
            (r'(<key>CFBundleIdentifier</key>\s*<string>).*?(</string>)', rf'\g<1>{package_name}\2'),
            (r'(<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>\s*<string>).*?(</string>)', rf'\g<1>{app_name} needs your location to assign nearby delivery jobs even in the background.\2'),
            (r'(<key>NSLocationWhenInUseUsageDescription</key>\s*<string>).*?(</string>)', rf'\g<1>{app_name} needs your location to assign nearby delivery jobs.\2'),
            (r'(<string>)(?:deliveryapp|[\w\-_]+delivery)(</string>)', rf'\g<1>{project_name}delivery\2'),
            (r'(<string>)com\.[a-zA-Z0-9_\.]+\.delivery(</string>)', rf'\g<1>{package_name}\2'),
        ], dry_run=dry_run)

    pbxproj = CONTENT_DIR / 'ios/Express24Delivery.xcodeproj/project.pbxproj'
    if pbxproj.is_file():
        log_step("Updating iOS Xcode project")
        update_file_regex(pbxproj, [
            (r'PRODUCT_BUNDLE_IDENTIFIER = ".*?";', f'PRODUCT_BUNDLE_IDENTIFIER = "{package_name}";'),
        ], dry_run=dry_run)

    # 15. Update package.json name
    package_json = CONTENT_DIR / 'package.json'
    update_file_regex(package_json, [
        (r'"name":\s*".*?"', f'"name": "{project_name}-delivery"'),
    ], dry_run=dry_run)

    print(f"\n{Style.BOLD}{Style.GREEN}🎉 REBRANDING COMPLETED SUCCESSFULLY!{Style.RESET}")
    print(f"{Style.CYAN}Summary:{Style.RESET}")
    print(f"  • Project Name: {project_name}")
    print(f"  • Package ID  : {package_name}")
    print(f"  • Display Name: {app_name}")
    if keystore_path:
        print(f"  • Keystore    : {keystore_path.name} (alias: {key_alias or keystore_path.stem})")
    print(f"  • Assets      : Generated all icons, mipmaps, and splash screens.\n")

def main():
    parser = argparse.ArgumentParser(description="MTB Store White-Label Delivery App Rebranding CLI Tool")
    parser.add_argument('--project', default='homebasket', help="Project slug / identifier (e.g. homebasket)")
    parser.add_argument('--package', default='com.homebasket.delivery', help="Android package name (e.g. com.homebasket.delivery)")
    parser.add_argument('--logo', default='homebasket_logo.jpeg', help="Path or filename of the new logo image")
    parser.add_argument('--name', default='HB Logistics', help="App display name (e.g. HB Logistics)")
    parser.add_argument('--keystore', default='homebasketdelivery.keystore', help="Path or filename of the client keystore")
    parser.add_argument('--key-alias', default=None, help="Key alias for release signing")
    parser.add_argument('--dry-run', action='store_true', help="Preview changes without writing to disk")

    args = parser.parse_args()

    logo_file = find_logo_file(args.logo)
    if not logo_file:
        print(f"\n{Style.RED}❌ Error: Logo file '{args.logo}' could not be found!{Style.RESET}")
        print("Please place the logo file in 'assets/' or root, or provide an absolute path.\n")
        sys.exit(1)

    keystore_file = find_keystore_file(args.keystore, args.project)

    run_rebrand(
        project_name=args.project,
        package_name=args.package,
        logo_path=logo_file,
        app_name=args.name,
        keystore_path=keystore_file,
        key_alias=args.key_alias,
        dry_run=args.dry_run
    )

if __name__ == '__main__':
    main()

