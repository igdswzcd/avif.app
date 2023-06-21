const { invoke } = window.__TAURI__.tauri;

let img_srcs = [];                // selected img_paths from rust
let img_datas = new Map();        // unique img datas save : task_status, img_path, avif_path, quality, effort, transparency
let default_effort = 0;
let default_quality = 70;
let default_transparency = true;
let default_viewer = 'chrome';
let global_save_path = null;
let current_focused_id = null;    // id generally equals to img_path
let running_queue = new Set();
let waiting_queue = [];
let parallel_limit = 6;           // limit size of running_queue

/**
 * get img_paths by rust
 */
async function get_imgs() {
  let selected_srcs = await invoke('select_imgs');
  img_srcs.push(...selected_srcs);
  update_table();
}
/**
 * get img size by rust
 * @param path
 * @returns bytes in Number
 */
async function get_file_size(path) {
  return await invoke('get_file_size', { path });
}
/**
 * trans size in readable format
 * @param size
 * @returns formatted string
 */
function format_size(size) {
  if (size === 0) return '0 b';
  const k = 1024;
  const sizes = ['b', 'kb', 'mb', 'gb', 'tb', 'pb'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
/**
 * the Size <td> has no innnerText before get_file_size()
 * update value here
 * @param path
 */
async function set_original_size(path) {
  const size = await get_file_size(path);
  const fsize = format_size(size);
  let tr = document.getElementById(path);
  let td_original_size = tr.querySelector(`td.td_original_size`);
  td_original_size.innerText = fsize;
  img_datas.get(path).origin_size = size;
}
/**
 * almost the same as set_original_size(), but avif
 * need to provide origin image path as id to query img_datas
 * @param id origin image path
 * @param path avif path
 */
async function set_cvted_size(id, path) {
  const size = await get_file_size(path);
  const fsize = format_size(size);
  let tr = document.getElementById(id);
  let td_reslut = tr.querySelector(`td.td_result`);
  let td_result_size = document.createElement('span');
  td_result_size.innerText = fsize;
  let td_result_comp = document.createElement('span');
  const change_ratio = (
    ((size - img_datas.get(id).origin_size) / img_datas.get(id).origin_size) *
    100
  ).toFixed(2);
  td_result_comp.innerText = `(${change_ratio}%)`;
  td_result_comp.style.color = change_ratio < 0 ? 'green' : 'red';
  td_reslut.appendChild(td_result_size);
  td_reslut.appendChild(td_result_comp);
}
/**
 * call browser to view avif by rust
 * in Win the cmd is 'start chrome path'
 * todo: should change some codes in other platform
 * @param path
 */
async function browser_preview(path) {
  await invoke('browser_open_avif', { path });
}
/**
 * create single convert task by rust
 * @param id
 */
async function new_cvt(id) {
  lock_params_when_running(id);
  let cvt_result = await invoke('new_cvt', {
    id,
    effort: img_datas.get(id).effort,
    quality: img_datas.get(id).quality,
    transparency: img_datas.get(id).transparency,
    savepath: global_save_path,
  });
  unlock_params(id);
  let cur_tr = document.getElementById(id);
  let cvt_btn = cur_tr.querySelector('#start_cvt');
  if (cvt_result === 'finished') {
    cvt_btn.innerText = 'DONE';
    const avif_path =
      global_save_path + '\\' + id.split('\\').pop().split('.')[0] + '.avif';
    img_datas.get(id).avif_path = avif_path;
    running_queue.delete(id);
    set_cvted_size(id, avif_path);
    let td_chrome = cur_tr.querySelector('td.td_chrome');
    td_chrome.innerText = '😎';
    td_chrome.style.cursor = 'pointer';
    td_chrome.addEventListener('click', (event) => {
      event.stopPropagation();
      browser_preview(avif_path);
    });
  } else {
    cvt_btn.innerText = 'FAIL';
    cvt_btn.backgroundColor = 'lightred';
  }
}
async function set_save_path() {
  let save_path = await invoke('set_save_path');
  if (save_path === '') {
    return;
  }
  global_save_path = save_path;
  let save_path_label = document.getElementById('save_path');
  save_path_label.innerText = '*Save Path: ' + save_path;
  let btn_add = document.getElementById('add_src');
  btn_add.removeAttribute('disabled');
}

const INIT = 0,
  WAIT = 1,
  CVRT = 2,
  FIN = 3,
  FIL = 4;

function lock_params_when_running(id) {
  let tr = document.getElementById(id);
  let td_effort_input = tr.querySelector(`td.td_effort input`);
  td_effort_input.setAttribute('disabled', '');
  let td_quality_input = tr.querySelector(`td.td_quality input`);
  td_quality_input.setAttribute('disabled', '');
  let td_transpy_select = tr.querySelector(`td.td_transpy select`);
  td_transpy_select.setAttribute('disabled', '');
}

function unlock_params(id) {
  let tr = document.getElementById(id);
  let td_effort_input = tr.querySelector(`td.td_effort input`);
  td_effort_input.removeAttribute('disabled');
  let td_quality_input = tr.querySelector(`td.td_quality input`);
  td_quality_input.removeAttribute('disabled');
  let td_transpy_select = tr.querySelector(`td.td_transpy select`);
  td_transpy_select.removeAttribute('disabled');
}

/**
 * trigger by import pictures, add record if unique
 */
function update_table() {
  let img_table = document.getElementById('img_table');
  for (let item of img_srcs) {
    if (img_datas.has(item)) {
      continue;
    }
    img_datas.set(item, {
      effort: default_effort,
      quality: default_quality,
      transparency: default_transparency,
      status: INIT,
      avif_path: null,
      origin_size: null,
    });
    let newTr = initTrTd(item);
    img_table.appendChild(newTr);
    set_original_size(item);
  }
}

function initTrTd(item_src) {
  let item_splits = item_src.split('\\');
  let rela_image_name = item_splits[item_splits.length - 1];
  let tr = document.createElement('tr');
  tr.id = item_src;
  let td_src = document.createElement('td');
  td_src.className = 'td_src';
  td_src.innerHTML = `<a>${rela_image_name.split('.')[0]}</a>`;
  td_src.style.cursor = 'pointer';
  td_src.addEventListener('click', (event) => {
    event.stopPropagation();
    browser_preview(item_src);
  });
  let td_fmt = document.createElement('td');
  td_fmt.className = 'td_fmt';
  td_fmt.innerText = rela_image_name.split('.')[1];
  let td_original_size = document.createElement('td');
  td_original_size.className = 'td_original_size';
  let td_effort = initTdEffort();
  let td_quality = initTdQuality();
  let td_transpy = initTdTransparency();
  let td_cvt = initTdCvt();
  let td_result = document.createElement('td');
  td_result.className = 'td_result';
  let td_chrome = document.createElement('td');
  td_chrome.className = 'td_chrome';
  tr.appendChild(td_src);
  tr.appendChild(td_fmt);
  tr.appendChild(td_original_size);
  tr.appendChild(td_effort);
  tr.appendChild(td_quality);
  tr.appendChild(td_transpy);
  tr.appendChild(td_cvt);
  tr.appendChild(td_result);
  tr.appendChild(td_chrome);
  tr.addEventListener('click', (event) => {
    let tgt = event.target;
    while (tgt.tagName !== 'TR') {
      tgt = tgt.parentNode;
    }
    let rows = document.querySelectorAll('tr');
    for (let row of rows) {
      row.style.backgroundColor = '';
    }
    tgt.focus();
    current_focused_id = tgt.id;
    const status = img_datas.get(current_focused_id).status;
    let btn_rm = document.getElementById('rm_src');
    if (status === WAIT || status === CVRT) {
      btn_rm.setAttribute('disabled', '');
    } else {
      btn_rm.removeAttribute('disabled');
    }
    tgt.style.backgroundColor = 'lightseagreen';
  });
  return tr;
}

function initTdEffort() {
  let td_effort = document.createElement('td');
  td_effort.className = 'td_effort';
  let td_effort_range = document.createElement('input');
  td_effort_range.type = 'range';
  td_effort_range.setAttribute('min', '0');
  td_effort_range.setAttribute('max', '100');
  td_effort_range.setAttribute('step', '5');
  td_effort_range.setAttribute('value', default_effort);
  let td_effort_range_span = document.createElement('span');
  td_effort_range_span.innerText =
    default_effort === 100 ? '100' : ' ' + default_effort;
  td_effort_range.addEventListener('input', (event) => {
    td_effort_range_span.innerText =
      event.target.value === 100 ? '100' : ' ' + event.target.value;
    const id = event.target.parentNode.parentNode.id;
    img_datas.get(id).effort = parseInt(event.target.value);
    reInitTdCvtBtn(id);
  });
  td_effort.appendChild(td_effort_range);
  td_effort.appendChild(td_effort_range_span);
  return td_effort;
}
function initTdQuality() {
  let td_quality = document.createElement('td');
  td_quality.className = 'td_quality';
  let td_quality_range = document.createElement('input');
  td_quality_range.type = 'range';
  td_quality_range.setAttribute('min', '0');
  td_quality_range.setAttribute('max', '100');
  td_quality_range.setAttribute('step', '5');
  td_quality_range.setAttribute('value', default_quality);
  let td_quality_range_span = document.createElement('span');
  td_quality_range_span.innerText =
    default_quality === 100 ? '100' : ' ' + default_quality;
  td_quality_range.addEventListener('input', (event) => {
    td_quality_range_span.innerText =
      event.target.value === 100 ? '100' : ' ' + event.target.value;
    const id = event.target.parentNode.parentNode.id;
    img_datas.get(id).quality = parseInt(event.target.value);
    reInitTdCvtBtn(id);
  });
  td_quality.appendChild(td_quality_range);
  td_quality.appendChild(td_quality_range_span);
  return td_quality;
}
function initTdTransparency() {
  let td_transpy = document.createElement('td');
  td_transpy.className = 'td_transpy';
  let td_transpy_select = document.createElement('select');
  td_transpy_select.innerHTML = `<option value="keep" ${default_transparency ? 'selected' : ''
    }>KEEP</option><option value="drop" ${default_transparency ? '' : 'selected'
    }>DROP</option>`;
  td_transpy_select.addEventListener('change', (event) => {
    const id = event.target.parentNode.parentNode.id;
    img_datas.get(id).transparency =
      event.target.selectedIndex === 0 ? true : false;
    reInitTdCvtBtn(id);
  });
  td_transpy.appendChild(td_transpy_select);
  return td_transpy;
}

function initTdCvt() {
  let td_cvt = document.createElement('td');
  td_cvt.className = 'td_cvt';
  let td_cvt_btn = document.createElement('button');
  td_cvt_btn.setAttribute('id', 'start_cvt');
  td_cvt_btn.innerText = 'BEGIN';
  td_cvt_btn.addEventListener('click', (event) => {
    img_datas.get(event.target.parentNode.parentNode.id).status = WAIT;
    waiting_queue.push(event.target.parentNode.parentNode.id);
    event.target.innerText = 'QUEUE';
    event.target.setAttribute('disabled', '');
  });
  td_cvt.appendChild(td_cvt_btn);
  return td_cvt;
}

function reInitTdCvtBtn(id) {
  img_datas.get(id).status = INIT;
  let tr = document.getElementById(id);
  let td_cvt_btn = tr.querySelector('td.td_cvt button');
  td_cvt_btn.removeAttribute('disabled');
  td_cvt_btn.innerText = 'BEGIN';
}

window.addEventListener('DOMContentLoaded', () => {
  let btn_add = document.getElementById('add_src');
  btn_add.addEventListener('click', () => {
    get_imgs();
  });
  let btn_set_save = document.getElementById('set_save');
  btn_set_save.addEventListener('click', () => {
    set_save_path();
  });
  let btn_rm = document.getElementById('rm_src');
  btn_rm.addEventListener('click', () => {
    if (current_focused_id === null) {
      return;
    }
    const status = img_datas.get(current_focused_id).status;
    if (status === INIT || status === FIN) {
      img_datas.delete(current_focused_id);
      let img_table = document.getElementById('img_table');
      let target_child = document.getElementById(current_focused_id);
      img_table.removeChild(target_child);
      current_focused_id = null;
      let btn_rm = document.getElementById('rm_src');
      btn_rm.setAttribute('disabled', '');
    }
  });

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
  let dft_parallel = document.getElementById('dft_parallel');
  dft_parallel.addEventListener('change', (event) => {
    parallel_limit = parseInt(event.target.value);
  });
});

/**
 * check waiting_queue, running_queue and limit every 500ms
 * if ok, move tasks from waiting to running and call new_cvt()
 */
setInterval(() => {
  console.log(waiting_queue.length, running_queue.size, 'aa');
  while (waiting_queue.length > 0) {
    if (running_queue.size < parallel_limit) {
      let next = waiting_queue.shift();
      running_queue.add(next);
      img_datas.get(next).status = CVRT;
      new_cvt(next);
      let tr = document.getElementById(next);
      let td_cvt_btn = tr.querySelector(`td.td_cvt button`);
      td_cvt_btn.innerText = 'Running';
    } else {
      break;
    }
  }
}, 500);
