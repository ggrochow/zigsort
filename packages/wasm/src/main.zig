const std = @import("std");
const allocator = std.heap.wasm_allocator;

pub extern fn logWasm(s: [*]const u8, len: usize) void;

// global data struct
const GlobalData = struct {
    input_img_pointer: ?[*]u8,
    input_img_size: ?usize,
    // options?
};

var globalData: GlobalData = .{
    .input_img_size = null,
    .input_img_pointer = null,
};

// module needs things before anything can happen
// need to alloc the image
// need to init with image len/height info
// need to init with any option

// TODO: init function
export fn alloc_input_image(size: usize) [*]u8 {
    const slice = allocator.alloc(u8, size) catch unreachable;

    globalData.input_img_pointer = slice.ptr;
    globalData.input_img_size = size;

    return slice.ptr;
}

// TODO: de-init for these
export fn deallocate_input_image(ptr: [*]u8, size: usize) void {
    allocator.free(ptr[0..size]);
}

export fn count_array() i32 {
    // TODO: better optional handling
    const ptr = globalData.input_img_pointer orelse return 0;
    const len = globalData.input_img_size orelse return 0;

    const slice = ptr[0..len];

    print("0-{d} - {any}", .{ slice.len, slice });

    return @intCast(slice[0]);
}

fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const slice = std.fmt.bufPrint(&buf, fmt, args) catch {
        logWasm(&buf, buf.len);
        return;
    };
    logWasm(slice.ptr, slice.len);
}
