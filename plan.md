# Pixel sorting but wasm

## Plan
user upload image 
select options
pixel sort in as close to realtime as we can and display

## steps
!serve html page
!build zig wasm module
!call zig wasm module from js in html page
!add file upload and canvas
pass canvas data to zig
do some stuff with said canvas data
display via JS
sort pixels via zig
add some other options / sort methods 

