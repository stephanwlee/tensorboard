load("@npm_angular_bazel//:index.bzl", "ng_module")

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
        "line_chart_interactive_layer.ts",
        "line_chart_module.ts",
    ],
    assets = [
        "line_chart_interactive_layer.ng.html",
    ],
    deps = [
        "//tensorboard/webapp/angular:expect_angular_cdk_overlay",
        "//tensorboard/webapp/widgets/line_chart_v2/lib",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:worker_layer",
        "@npm//@angular/common",
        "@npm//@angular/core",
    ],
)
