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

// ptr is pointing a slice of u8s of len size
// 4 u8s represent 1 pixel, being R G B A in that order.
export fn process_img(ptr: [*]u8, size: usize, img_height: u32, img_width: u32) u32 {
    print("h-{d} w-{d}", .{ img_height, img_width });

    // loop through each row of pixels
    var y: usize = 0;
    while (y < img_height) : (y += 1) {
        // pixels comes in groups of 4 numbers get the correct index
        const row_start_idx = y * img_width * 4;

        var x: usize = 0;
        while (x < img_width) : (x += 1) {
            const px_start_index = row_start_idx + (x * 4);
            const r = ptr[px_start_index];
            const g = ptr[px_start_index + 1];
            const b = ptr[px_start_index + 2];

            const lightness = percievedLigthness(r, g, b);
            const lightness_norm: f64 = 255 * (@as(f64, @floatFromInt(lightness)) / 100.0);

            ptr[px_start_index + 3] = @intFromFloat(lightness_norm);
            // print("light-{d}", .{lightness});
        }

        // print("x-{d}", .{x});

        // first we must find the groups of pixels we will to sort in this row.
        // we will then sort the groupings by the brightness value of the pixel
        // and update the image data directly after the grouping is complete
    }

    // print("y-{d}", .{y});
    //  var i: usize = 0;
    //  while (i + 3 < size) : (i += 4) {
    //      const r = ptr[i];
    //      const g = ptr[i + 1];
    //      const b = ptr[i + 2];
    //  }

    _ = size;
    return y;
}

fn percievedLigthness(r: u8, g: u8, b: u8) u8 {
    const vr: f64 = @as(f64, @floatFromInt(r)) / 255.0;
    const vg: f64 = @as(f64, @floatFromInt(g)) / 255.0;
    const vb: f64 = @as(f64, @floatFromInt(b)) / 255.0;

    const luminance =
        (0.2126 * sRGBToLinear(vr) +
        0.7152 * sRGBToLinear(vg) +
        0.0722 * sRGBToLinear(vb));

    var lightness: f64 = undefined;
    if (luminance <= 0.008856) {
        lightness = luminance * 903.3;
    } else {
        lightness = std.math.pow(f64, luminance, 1.0 / 3.0) * 116.0 - 16.0;
    }

    return @intFromFloat(lightness);
}

fn sRGBToLinear(color: f64) f64 {
    if (color <= 0.04045) {
        return color / 12.92;
    }

    return std.math.pow(f64, (color + 0.055) / 1.055, 2.4);
}

fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const slice = std.fmt.bufPrint(&buf, fmt, args) catch {
        logWasm(&buf, buf.len);
        return;
    };
    logWasm(slice.ptr, slice.len);
}
