const { invoke } = window.__TAURI__.tauri;

let greetInputEl;
let greetMsgEl;
let img_srcs = [];
let img_datas = new Map();
let default_effort = 30;
let default_quality = 70;
let default_transparency = true;
async function greet() {
  // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
}

async function get_imgs() {
  let selected_srcs = await invoke("select_imgs");
  img_srcs.push(...selected_srcs);
  console.log(img_srcs);
  update_table();
}

function update_table() {
  let img_table = document.getElementById('img_table');
  for (let item of img_srcs) {
    if (img_datas.has(item)) {
      continue;
    }
    img_datas.set(item, { effort: 30, quality: 70, transparency: true });
    let newTr = initTrTd(item);
    img_table.appendChild(newTr);
  }
}


function initTrTd(item_src) {
  let item_splits = item_src.split('\\');
  let rela_image_name = item_splits[item_splits.length - 1];
  let tr = document.createElement('tr');
  tr.id = item_src;
  let td_src = document.createElement('td');
  td_src.className = 'td_src';
  td_src.innerText = rela_image_name.split('.')[0];
  let td_fmt = document.createElement('td');
  td_fmt.className = 'td_fmt';
  td_fmt.innerText = rela_image_name.split('.')[1];
  let td_effort = document.createElement('td');
  td_effort.className = 'td_effort';
  td_effort.innerHTML = `<input type="range" min="0" max="100" step="5" value="${default_effort}"><span> ${default_effort}</span>`;
  let td_quality = document.createElement('td');
  td_quality.className = 'td_quality';
  td_quality.innerHTML = `<input type="range" min="0" max="100" step="5" value="${default_quality}"><span> ${default_quality}</span>`;
  let td_transpy = document.createElement('td');
  td_transpy.className = 'td_transpy';
  td_transpy.innerHTML = `<select><option value="keep" ${default_transparency ? 'selected' : ''}>保留</option><option value="drop" ${default_transparency ? '' : 'selected'}>不保留</option></select>`;
  let td_cvt = document.createElement('td');
  td_cvt.className = 'td_cvt';
  td_cvt.innerHTML = `<button>开始</button>`;
  let td_progress = document.createElement('td');
  td_progress.className = 'td_progress';
  td_progress.innerText = 'Ready...';
  let td_result = document.createElement('td');
  td_result.className = 'td_result';
  td_result.innerText = '0kb';
  let td_chrome = document.createElement('td');
  td_chrome.className = 'td_chrome';
  td_chrome.innerText = 'link';
  tr.appendChild(td_src);
  tr.appendChild(td_fmt);
  tr.appendChild(td_effort);
  tr.appendChild(td_quality);
  tr.appendChild(td_transpy);
  tr.appendChild(td_cvt);
  tr.appendChild(td_progress);
  tr.appendChild(td_result);
  tr.appendChild(td_chrome);
  tr.addEventListener('click', (event) => {
    let tgt = event.target;
    while (tgt.tagName !== 'TR') {
      tgt = tgt.parentNode;
    }
    console.log(tgt);
    let rows = document.querySelectorAll('tr');
    for (let row of rows) {
      row.style.backgroundColor = '';
    }
    tgt.focus();
    tgt.style.backgroundColor = 'green';
  })
  return tr;
}

window.addEventListener("DOMContentLoaded", () => {
  let btn = document.getElementById('add_src');
  btn.addEventListener('click', () => {
    get_imgs();
  })
  let dft_eft = document.getElementById('dft_eft');
  dft_eft.addEventListener('change', (event) => {
    default_effort = parseInt(event.target.value);
  });
  let dft_qlty = document.getElementById('dft_qlty');
  dft_qlty.addEventListener('change', (event) => {
    default_quality = parseInt(event.target.value);
  });
  let dft_tspy = document.getElementById('dft_tspy');
  dft_tspy.addEventListener('change', (event) => {
    default_transparency = event.target.selectedIndex === 0 ? true : false;
  });
});
