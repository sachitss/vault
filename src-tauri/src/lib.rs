//! Valuables Vault native shell.
//!
//! The whole application (encryption, inventory, reports, import/export) is the
//! same web code that runs in browsers (`dist/app`). This shell adds what a browser
//! cannot do: a private, non-evictable storage location per user account, native
//! save/open dialogs, opening links in the system browser, QR scanning with the
//! camera on phones and tablets, a single instance on desktop (two windows must
//! never edit the same vault at once), remembered window size, reminder
//! notifications and signed automatic updates on desktop.
//!
//! No network access is configured: the Content-Security-Policy in tauri.conf.json
//! allows only Tauri's local IPC channel.

/// Prints the app window. The web layer first makes only the report visible
/// (see src/platform.js), so this prints the report. Desktop only.
#[cfg(desktop)]
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Must be the first plugin: a second launch focuses the running window instead.
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_window_state::Builder::default().build())
            // signed updates from GitHub Releases (public key in tauri.conf.json)
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .invoke_handler(tauri::generate_handler![print_page]);
    }

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // reminder notifications (scheduled in the OS on phones and tablets)
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running Valuables Vault");
}
