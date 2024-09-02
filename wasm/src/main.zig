const std = @import("std");
const allocator = std.heap.wasm_allocator;

pub extern fn logWasm(s: [*]const u8, len: usize) void;

export fn alloc_input_image(size: usize) [*]u8 {
    const slice = allocator.alloc(u8, size) catch @panic("failed alloc_input_image");

    return slice.ptr;
}

export fn deallocate_input_image(ptr: [*]u8, size: usize) void {
    allocator.free(ptr[0..size]);
}

// fn load_img
// allocs
// setup pixelData for the image

// fn unload_image
// de-allocs old image

const PixelData = struct {
    sortValue: u8,
    r: u8,
    g: u8,
    b: u8,
};
const PixelGroup = struct { pixels: []PixelData, start_idx: usize };

// ptr is pointing a slice of u8s of len size
// 4 u8s represent 1 pixel, being R G B A in that order.
export fn process_img(ptr: [*]u8, size: usize, img_height: u32, img_width: u32, brightness_min: u8, brightness_max: u8) u32 {
    // first we must find the groups of pixels we will to sort in this row.
    // we will then sort the groupings by the brightness value of the pixel
    // and update the image data directly after the grouping is complete
    const img = ptr[0..size];

    // holds our pixelData as we work on a row
    var rowPixels = std.ArrayList(PixelData).init(allocator);
    defer rowPixels.deinit();
    rowPixels.ensureTotalCapacity(@intCast(img_width)) catch @panic("rowdata resize failed");

    // holds groupings of pixel data for a given row
    var rowGrouping = std.ArrayList(PixelGroup).init(allocator);
    defer rowGrouping.deinit();

    // start working through each row
    var y: usize = 0;
    while (y < img_height) : (y += 1) {
        const row_start_idx = y * img_width * 4;
        const row = img[row_start_idx .. row_start_idx + (img_width * 4)];

        // walk each pixel and setup our rowData with the data needed to sort/group
        var row_idx: usize = 0;
        while (row_idx < row.len) : (row_idx += 4) {
            const r = row[row_idx];
            const g = row[row_idx + 1];
            const b = row[row_idx + 2];

            const pixelData = .{
                .sortValue = percievedLigthness(r, g, b),
                .r = r,
                .g = g,
                .b = b,
            };

            rowPixels.append(pixelData) catch @panic("rowdata append failed");
        }

        // walk our rowData to generate our sub-rows to sort within.
        // using the sortValue and some threshholds for now to see if we need a new bucket
        var interval_start: usize = 0;
        var in_interval: bool = false;
        for (rowPixels.items, 0..) |item, i| {
            if (item.sortValue < brightness_min or item.sortValue > brightness_max) {
                if (!in_interval) {
                    in_interval = true;
                    interval_start = i;
                }
            } else {
                // only append groupings when we are in an interval
                // no point adding single pixels to sort on
                if (in_interval) {
                    in_interval = false;
                    const grouping: PixelGroup = .{
                        .pixels = rowPixels.items[interval_start..i],
                        .start_idx = interval_start,
                    };

                    rowGrouping.append(grouping) catch @panic("rowGrouping append failed");
                }
            }
        }

        // go through each grouping, sorting the slice by sortValue.
        for (rowGrouping.items) |grouping| {
            std.mem.sort(PixelData, grouping.pixels, {}, sortPixelData);
            // go through sorted slice and apply the stuff
            for (grouping.pixels, 0..) |pixel, i| {
                // row is RGBA values, index is from pixelData not row
                // we must multiply by 4 to get the actual row index
                const group_row_idx = (grouping.start_idx + i) * 4;

                row[group_row_idx] = pixel.r;
                row[group_row_idx + 1] = pixel.g;
                row[group_row_idx + 2] = pixel.b;
            }
        }

        rowPixels.clearRetainingCapacity();
        rowGrouping.clearRetainingCapacity();
    }

    return y;
}

// less than sort
fn sortPixelData(context: void, lhs: PixelData, rhs: PixelData) bool {
    _ = context;
    return lhs.sortValue < rhs.sortValue;
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
