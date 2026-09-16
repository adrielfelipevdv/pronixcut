struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct ChromaKeyUniforms {
    key_color_and_similarity: vec4f,
    softness_feather_spill_opacity: vec4f,
    resolution: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: ChromaKeyUniforms;

fn key_alpha_at(color: vec3f, key_color: vec3f, edge_start: f32, edge_end: f32) -> f32 {
    let distance = length(color - key_color);
    return clamp((distance - edge_start) / (edge_end - edge_start), 0.0, 1.0);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let source = textureSample(input_texture, input_sampler, input.tex_coord);
    let key_color = uniforms.key_color_and_similarity.rgb;
    let similarity = uniforms.key_color_and_similarity.a;
    let softness = max(uniforms.softness_feather_spill_opacity.x, 0.0001);
    let feather_px = uniforms.softness_feather_spill_opacity.y;
    let spill = uniforms.softness_feather_spill_opacity.z;
    let effect_opacity = uniforms.softness_feather_spill_opacity.w;
    let edge_start = similarity;
    let edge_end = similarity + softness;

    var key_alpha = key_alpha_at(source.rgb, key_color, edge_start, edge_end);

    if (feather_px > 0.01) {
        let texel_size = vec2f(1.0, 1.0) / max(uniforms.resolution.xy, vec2f(1.0, 1.0));
        var sum = key_alpha;
        var count = 1.0;
        let ring_count = 8;
        for (var index = 0; index < ring_count; index = index + 1) {
            let angle = (f32(index) / f32(ring_count)) * 6.28318530718;
            let sample_uv = input.tex_coord
                + vec2f(cos(angle), sin(angle)) * texel_size * feather_px;
            let sample_color = textureSample(input_texture, input_sampler, sample_uv).rgb;
            sum = sum + key_alpha_at(sample_color, key_color, edge_start, edge_end);
            count = count + 1.0;
        }
        key_alpha = sum / count;
    }

    var rgb = source.rgb;
    if (spill > 0.0) {
        let distance = length(source.rgb - key_color);
        let closeness = 1.0 - clamp(distance / edge_end, 0.0, 1.0);
        let luma = dot(rgb, vec3f(0.299, 0.587, 0.114));
        rgb = mix(rgb, vec3f(luma), closeness * spill);
    }

    let kept_alpha = source.a * key_alpha;
    let out_alpha = mix(source.a, kept_alpha, effect_opacity);
    let out_rgb = mix(source.rgb, rgb, effect_opacity);
    return vec4f(out_rgb, out_alpha);
}
