// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{env, fs};
use tauri::api::dialog::blocking::FileDialogBuilder;
mod avif;
mod yuv;
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn select_imgs() -> Vec<String> {
    let img_paths = FileDialogBuilder::new()
        .add_filter(
            "Images(.png,.jpg,.jpeg,.webp,.gif,.bmp,.dib,.ico,.tiff,.tif,.pbm,.pgm,.ppm,.pnm,.dds,.tga,.icb,.vda,.vst,.ff)",
            &[
                "png", "jpg", "jpeg", "webp", "gif", "bmp", "dib", "ico", "tiff", "tif",
                "pbm", "pgm", "ppm", "pnm", "dds", "tga", "icb", "vda", "vst", "ff",
            ],
        )
        .pick_files();
    match img_paths {
        Some(paths) => {
            let strings: Vec<String> = paths
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            strings
        }
        None => Vec::new(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, select_imgs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
