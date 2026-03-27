const encodingPresets = [
    // AV1 Software
    // AV1 Software
    { id: 'av1_1080p24', name: 'AV1 1080p24', codec: 'libaom-av1', resolution: '1920:1080', fps: '24000/1001', crf: 30, group: 'AV1' },
    { id: 'av1_720p24', name: 'AV1 720p24', codec: 'libaom-av1', resolution: '1280:720', fps: '24000/1001', crf: 30, group: 'AV1' },
    { id: 'av1_480p24', name: 'AV1 480p24', codec: 'libaom-av1', resolution: '854:480', fps: '24000/1001', crf: 30, group: 'AV1' },
    { id: 'av1_360p24', name: 'AV1 360p24', codec: 'libaom-av1', resolution: '640:360', fps: '24000/1001', crf: 30, group: 'AV1' },
    { id: 'av1_240p24', name: 'AV1 240p24', codec: 'libaom-av1', resolution: '426:240', fps: '24000/1001', crf: 30, group: 'AV1' },

    // H.265 Software
    { id: 'h265_1080p24', name: 'H.265 1080p24', codec: 'libx265', resolution: '1920:1080', fps: '24000/1001', crf: 28, group: 'H.265 (HEVC)' },
    { id: 'h265_720p24', name: 'H.265 720p24', codec: 'libx265', resolution: '1280:720', fps: '24000/1001', crf: 28, group: 'H.265 (HEVC)' },
    { id: 'h265_480p24', name: 'H.265 480p24', codec: 'libx265', resolution: '854:480', fps: '24000/1001', crf: 28, group: 'H.265 (HEVC)' },
    { id: 'h265_360p24', name: 'H.265 360p24', codec: 'libx265', resolution: '640:360', fps: '24000/1001', crf: 28, group: 'H.265 (HEVC)' },
    { id: 'h265_240p24', name: 'H.265 240p24', codec: 'libx265', resolution: '426:240', fps: '24000/1001', crf: 28, group: 'H.265 (HEVC)' },

    // H.264 Software
    { id: 'h264_1080p24', name: 'H.264 1080p24', codec: 'libx264', resolution: '1920:1080', fps: '24000/1001', crf: 23, group: 'H.264 (AVC)' },
    { id: 'h264_720p24', name: 'H.264 720p24', codec: 'libx264', resolution: '1280:720', fps: '24000/1001', crf: 23, group: 'H.264 (AVC)' },
    { id: 'h264_480p24', name: 'H.264 480p24', codec: 'libx264', resolution: '854:480', fps: '24000/1001', crf: 23, group: 'H.264 (AVC)' },
    { id: 'h264_360p24', name: 'H.264 360p24', codec: 'libx264', resolution: '640:360', fps: '24000/1001', crf: 23, group: 'H.264 (AVC)' },
    { id: 'h264_240p24', name: 'H.264 240p24', codec: 'libx264', resolution: '426:240', fps: '24000/1001', crf: 23, group: 'H.264 (AVC)' },
];

module.exports = encodingPresets;
