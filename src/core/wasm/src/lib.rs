use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn do_task(size: usize) {
    let mut pixels = vec![0u8; size];
    for i in 0..size {
        pixels[i] = (i % 256) as u8;
    }

    // Write-only
    let start = js_sys::Date::now();
    for i in 0..size {
        pixels[i] = 9;
    }
    let end = js_sys::Date::now();
    log(&format!("Write-only: {:.2} ms", end - start));

    // Read sum
    let start = js_sys::Date::now();
    let mut sum: u64 = 0;
    for i in 0..size {
        sum += pixels[i] as u64;
    }
    let end = js_sys::Date::now();
    log(&format!("Read sum: {:.2} ms, sum: {}", end - start, sum));

    // Pure loop
    let start = js_sys::Date::now();
    let mut sum2 = 0;
    for _ in 0..size {
        sum2 += 1;
    }
    let end = js_sys::Date::now();
    log(&format!("Pure count: {:.2} ms, sum: {}", end - start, sum2));

    // Read-modify-write (double)
    let start = js_sys::Date::now();
    for i in 0..size {
        let v = pixels[i];
        pixels[i] = v.wrapping_add(v);
    }
    let end = js_sys::Date::now();
    log(&format!("Double: {:.2} ms", end - start));

    // Read-modify-write (next index)
    let start = js_sys::Date::now();
    for i in 0..size {
        let next = if i + 1 < size { i + 1 } else { 0 };
        let sum = pixels[i].wrapping_add(pixels[next]);
        pixels[i] = sum;
    }
    let end = js_sys::Date::now();
    log(&format!("Add with next: {:.2} ms", end - start));
}

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
