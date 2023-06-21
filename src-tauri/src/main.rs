// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use open;
use std::io::{Read, Write};
use std::{env, fs};
use tauri::api::dialog::blocking::FileDialogBuilder;

use crate::avif::{convert_to_avif, ConversionOptions};
use crate::yuv::Subsampling;
mod avif;
mod yuv;
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn select_imgs() -> Vec<String> {
    let img_paths = FileDialogBuilder::new()
        .add_filter(
            "Images(.png,.jpg,.jpeg,.webp,.gif,.bmp,.dib,.ico,.tiff,.tif,.pbm,.pgm,.ppm,.pnm,.dds,.tga,.icb,.vda,.vst,.ff)",
            &[
                "png", "jpg", "jpeg", "webp", "gif", "bmp", "dib", "ico", "tiff", "tif",
                "pbm", "pgm", "ppm", "pnm", "dds", "tga", "icb", "vda", "vst", "ff"
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

#[tauri::command]
fn get_file_size(path: String) -> u64 {
    let metadata = fs::metadata(path).unwrap();
    metadata.len()
}

#[tauri::command]
fn set_save_path() -> String {
    let save_folder = FileDialogBuilder::new().pick_folder();
    match save_folder {
        Some(path) => path.to_string_lossy().into_owned(),
        None => String::new(),
    }
}

#[tauri::command]
fn browser_open_avif(path: String) {
    // todo: I found that if there's only 'chrome', not working in Windows
    // maybe here should be two tauri::command to be compatible with MacOS or others
    open::with(&path, "start chrome").unwrap();
}

#[tauri::command]
async fn new_cvt(
    id: String,
    effort: u8,
    quality: u8,
    transparency: bool,
    savepath: String,
) -> String {
    println!(
        "{}, {}, {}, {}, {}",
        id, effort, quality, transparency, savepath
    );
    let cvt_options = ConversionOptions::new(effort, quality, Subsampling::YUV444, transparency);
    let mut input = Vec::new();
    fs::File::open(&id)
        .unwrap()
        .read_to_end(&mut input)
        .unwrap();
    let input = input;
    let result = convert_to_avif(&input, &cvt_options).unwrap();
    let pic_name = id.split("\\").last().unwrap().split(".").next().unwrap();
    let where_to_save = format!("{savepath}\\{pic_name}.avif");
    let mut output_file = fs::File::create(where_to_save).unwrap();
    let cvt_res = output_file.write_all(&result);
    match cvt_res {
        Ok(_) => String::from("finished"),
        Err(_) => String::from("failed"),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            select_imgs,
            get_file_size,
            set_save_path,
            browser_open_avif,
            new_cvt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
