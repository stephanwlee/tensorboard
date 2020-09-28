load("//tensorboard/defs:defs.bzl", "tf_js_binary", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

tf_ts_library(
    name = "lib",
    srcs = [
        "axis_view.ts",
        "layer.ts",
        "layer_types.ts",
        "layout_util.ts",
        "series_line_view.ts",
    ],
    deps = [
        ":common",
        ":layout",
        ":scale",
        ":types",
        "@npm//@types/d3",
        "@npm//@types/d3-array",
        "@npm//@types/d3-format",
        "@npm//d3",
        "@npm//d3-array",
        "@npm//d3-format",
        "@npm//three",
    ],
)

tf_ts_library(
    name = "common",
    srcs = [
        "color_provider.ts",
        "coordinator.ts",
        "renderer.ts",
        "renderer_types.ts",
    ],
    deps = [
        ":scale",
        ":types",
        "//tensorboard/webapp/widgets/line_chart_v2/lib/fonts:roboto",
        "@npm//three",
    ],
)

tf_ts_library(
    name = "layout",
    srcs = [
        "composite_layout.ts",
        "drawable.ts",
        "flex_layout.ts",
        "layout.ts",
        "root_layout.ts",
    ],
    deps = [
        ":common",
        ":scale",
        ":types",
        "@npm//@types/d3",
        "@npm//@types/d3-array",
        "@npm//@types/d3-format",
        "@npm//d3",
        "@npm//d3-array",
        "@npm//d3-format",
    ],
)

tf_ts_library(
    name = "types",
    srcs = [
        "types.ts",
    ],
)

tf_ts_library(
    name = "scale",
    srcs = [
        "scale.ts",
    ],
    deps = [
        ":types",
        "@npm//@tensorflow/tfjs",
        "@npm//@types/d3-scale",
        "@npm//d3-scale",
    ],
)

tf_ts_library(
    name = "worker_layer",
    srcs = ["worker_layer.ts"],
    deps = [
        ":lib",
        ":types",
        ":worker",
        ":worker_layer_types",
    ],
)

tf_ts_library(
    name = "worker_layer_types",
    srcs = ["worker_layer_types.ts"],
    deps = [
        ":types",
    ],
)

tf_ts_library(
    name = "worker",
    srcs = ["worker.ts"],
)

tf_ts_library(
    name = "worker_layer_bridge",
    srcs = ["worker_layer_bridge.ts"],
    deps = [
        ":lib",
        ":types",
        ":worker_layer_types",
    ],
)

tf_js_binary(
    name = "chart_worker",
    compile = True,
    entry_point = "worker_layer_bridge.ts",
    deps = [
        ":worker_layer_bridge",
    ],
)
