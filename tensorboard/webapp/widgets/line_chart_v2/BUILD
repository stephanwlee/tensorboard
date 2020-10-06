load("@npm_angular_bazel//:index.bzl", "ng_module")
load("//tensorboard/defs:defs.bzl", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])  # Apache 2.0

ng_module(
    name = "line_chart_demo",
    srcs = [
        "create_data.ts",
        "line_chart_demo_component.ts",
        "line_chart_demo_module.ts",
    ],
    deps = [
        ":line_chart_v2",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
        "@npm//@angular/common",
        "@npm//@angular/core",
        "@npm//@types/d3",
        "@npm//d3",
        "@npm//plottable",
    ],
)

ng_module(
    name = "line_chart_v2",
    srcs = [
        "line_chart_component.ts",
        "line_chart_module.ts",
    ],
    deps = [
        "//tensorboard/webapp/widgets:resize_detector",
        "//tensorboard/webapp/widgets/line_chart_v2/lib",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:worker_layer",
        "//tensorboard/webapp/widgets/line_chart_v2/sub_view",
        "//tensorboard/webapp/widgets/perf",
        "@npm//@angular/common",
        "@npm//@angular/core",
    ],
)

tf_ts_library(
    name = "data_transformer",
    srcs = ["data_transformer.ts"],
    deps = ["//tensorboard/webapp/widgets/line_chart_v2/lib:types"],
)
