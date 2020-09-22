load("//tensorboard/defs:defs.bzl", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

tf_ts_library(
    name = "lib",
    srcs = [
        "axis_view.ts",
        "color_provider.ts",
        "composite_layout.ts",
        "coordinator.ts",
        "drawable.ts",
        "flex_layout.ts",
        "layout.ts",
        "line_chart.ts",
        "renderer.ts",
        "renderer_types.ts",
        "root_layout.ts",
        "series_line_view.ts",
    ],
    deps = [
        ":scale",
        ":types",
        "//tensorboard/webapp/widgets/line_chart_v2/lib/fonts:roboto",
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
        "@npm//@types/d3-scale",
        "@npm//d3-scale",
    ],
)
