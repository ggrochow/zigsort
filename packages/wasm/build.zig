const std = @import("std");

// Although this function looks imperative, note that its job is to
// declaratively construct a build graph that will be executed by an external
// runner.
pub fn build(b: *std.Build) void {
    const wasm_target = b.resolveTargetQuery(std.Target.Query.parse(
        .{ .arch_os_abi = "wasm32-freestanding" },
    ) catch unreachable);

    const optimize = b.standardOptimizeOption(.{});

    const wasm = b.addExecutable(.{
        .name = "pixelsorter",
        .root_source_file = b.path("src/main.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });

    wasm.entry = .disabled;
    wasm.rdynamic = true;

    b.installArtifact(wasm);
}
