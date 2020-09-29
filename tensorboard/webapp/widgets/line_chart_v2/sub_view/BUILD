load("@npm_angular_bazel//:index.bzl", "ng_module")
load("//tensorboard/defs:defs.bzl", "tf_sass_binary")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])  # Apache 2.0

tf_sass_binary(
    name = "line_chart_interactive_layer_styles",
    src = "line_chart_interactive_layer.scss",
)

ng_module(
    name = "sub_view",
    srcs = [
        "line_chart_axis_view.ts",
        "line_chart_grid_view.ts",
        "line_chart_interactive_layer.ts",
        "ng_line_chart_view.ts",
        "sub_view_module.ts",
    ],
    assets = [
        ":line_chart_interactive_layer_styles",
        "line_chart_interactive_layer.ng.html",
    ],
    deps = [
        "//tensorboard/webapp/angular:expect_angular_cdk_overlay",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:scale",
        "//tensorboard/webapp/widgets/line_chart_v2/lib:types",
        "@npm//@angular/common",
        "@npm//@angular/core",
        "@npm//@types/d3-array",
        "@npm//@types/d3-format",
        "@npm//d3-array",
        "@npm//d3-format",
    ],
)
