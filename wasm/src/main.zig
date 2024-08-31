const std = @import("std");
const allocator = std.heap.wasm_allocator;

pub extern fn logWasm(s: [*]const u8, len: usize) void;

// global data struct
const GlobalData = struct {
    // options?
};

var globalData: GlobalData = .{};

// module needs things before anything can happen
// need to alloc the image
// need to init with image len/height info
// need to init with any option

export fn alloc_input_image(size: usize) [*]u8 {
    const slice = allocator.alloc(u8, size) catch unreachable;

    return slice.ptr;
}

export fn deallocate_input_image(ptr: [*]u8, size: usize) void {
    allocator.free(ptr[0..size]);
}

// ptr + size
export fn process_img(ptr: [*]u8, size: usize, img_height: u32, img_width: u32) u32 {
    print("h-{d} w-{d}", .{ img_height, img_width });

    var i: usize = 0;
    while (i + 3 < size) : (i += 4) {
        const r = ptr[i];
        const g = ptr[i + 1];
        const b = ptr[i + 2];

        ptr[i] = b;
        ptr[i + 1] = g;
        ptr[i + 2] = r;
    }

    return 0;
}

fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const slice = std.fmt.bufPrint(&buf, fmt, args) catch {
        logWasm(&buf, buf.len);
        return;
    };
    logWasm(slice.ptr, slice.len);
}
