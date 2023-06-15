const { invoke } = window.__TAURI__.tauri;

let greetInputEl;
let greetMsgEl;
let img_srcs = [];
async function greet() {
  // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
}

async function get_imgs() {
  let selected_srcs = await invoke("select_imgs");
  img_srcs.push(selected_srcs);
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form").addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });
  document.querySelector("#add_src").addEventListener("submit", (e) => {
    e.preventDefault();
    get_imgs();
  })
});
