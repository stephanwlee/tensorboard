load("@npm_angular_bazel//:index.bzl", "ng_module")
load("//tensorboard/defs:defs.bzl", "tf_js_binary", "tf_ts_library")

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
        ":offscreen_chart_types",
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
        "line_chart_interactive_layer.ts",
        "line_chart_module.ts",
        "offscreen_line_chart.ts",
        "worker.ts",
    ],
    assets = [
      "line_chart_interactive_layer.ng.html",
    ],
    deps = [
        ":offscreen_chart_types",
        "//tensorboard/webapp/angular:expect_angular_cdk_overlay",
        "//tensorboard/webapp/widgets/line_chart_v2/lib",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
        "@npm//@angular/common",
        "@npm//@angular/core",
    ],
)

tf_ts_library(
    name = "offscreen_chart_types",
    srcs = ["offscreen_chart_types.ts"],
    deps = [
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
    ],
)

tf_ts_library(
    name = "worker_chart_bridge",
    srcs = ["worker_chart_bridge.ts"],
    deps = [
        ":offscreen_chart_types",
        "//tensorboard/webapp/widgets/line_chart_v2/lib",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
    ],
)

tf_js_binary(
    name = "chart_worker",
    compile = True,
    entry_point = "worker_chart_bridge.ts",
    deps = [
        ":worker_chart_bridge",
    ],
)
