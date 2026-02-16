// Color Palettes Module
// Defines all available color palettes with optimized subsets for each difficulty level

const ColorPalettes = (() => {
    
    // Each palette has 8 colors, plus optimized subsets for 4, 5, 6, 7 colors
    // Subsets are chosen to maximize visual diversity (spread across hue/luminance)
    
    const palettes = {
        // === CURRENT/DEFAULT ===
        'classic': {
            name: 'Classic',
            category: 'Standard',
            colors: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#85C1E2', '#BB8FCE', '#FFB3D9'],
            sets: {
                4: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1'],
                5: ['#FF6B6B', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
                6: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE'],
                7: ['#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788', '#45B7D1', '#BB8FCE', '#FFB3D9'],
                8: null // uses full colors array
            }
        },
        
        // === VIBRANT ===
        'neon': {
            name: 'Neon',
            category: 'Vibrant',
            colors: ['#FF0080', '#FF4400', '#FFFF00', '#00FF66', '#00FFFF', '#0088FF', '#AA00FF', '#FF00AA'],
            sets: {
                4: ['#FF0080', '#FFFF00', '#00FF66', '#0088FF'],
                5: ['#FF0080', '#FFFF00', '#00FF66', '#0088FF', '#AA00FF'],
                6: ['#FF0080', '#FF4400', '#FFFF00', '#00FF66', '#00FFFF', '#AA00FF'],
                7: ['#FF0080', '#FF4400', '#FFFF00', '#00FF66', '#00FFFF', '#0088FF', '#AA00FF'],
                8: null
            }
        },
        'cyberpunk': {
            name: 'Cyberpunk',
            category: 'Vibrant',
            colors: ['#FF0055', '#FF6600', '#FFEE00', '#00FF9F', '#00EEFF', '#0066FF', '#9D00FF', '#FF00FF'],
            sets: {
                4: ['#FF0055', '#FFEE00', '#00FF9F', '#0066FF'],
                5: ['#FF0055', '#FFEE00', '#00FF9F', '#0066FF', '#9D00FF'],
                6: ['#FF0055', '#FF6600', '#FFEE00', '#00FF9F', '#00EEFF', '#9D00FF'],
                7: ['#FF0055', '#FF6600', '#FFEE00', '#00FF9F', '#00EEFF', '#0066FF', '#9D00FF'],
                8: null
            }
        },
        'highcontrast': {
            name: 'High Contrast',
            category: 'Vibrant',
            colors: ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8800FF', '#FF00FF'],
            sets: {
                4: ['#FF0000', '#FFFF00', '#00FF00', '#0000FF'],
                5: ['#FF0000', '#FFFF00', '#00FF00', '#0000FF', '#FF00FF'],
                6: ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00FFFF', '#8800FF'],
                7: ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF'],
                8: null
            }
        },
        
        // === SOFT ===
        'pastel': {
            name: 'Pastel',
            category: 'Soft',
            colors: ['#FFB5B5', '#FFCBA4', '#FFF4B8', '#B5EAD7', '#B5D8EB', '#C7CEEA', '#E2B5EA', '#FFDAF0'],
            sets: {
                4: ['#FFB5B5', '#FFF4B8', '#B5EAD7', '#C7CEEA'],
                5: ['#FFB5B5', '#FFF4B8', '#B5EAD7', '#C7CEEA', '#E2B5EA'],
                6: ['#FFB5B5', '#FFCBA4', '#FFF4B8', '#B5EAD7', '#B5D8EB', '#E2B5EA'],
                7: ['#FFB5B5', '#FFCBA4', '#FFF4B8', '#B5EAD7', '#B5D8EB', '#C7CEEA', '#E2B5EA'],
                8: null
            }
        },
        'muted': {
            name: 'Muted',
            category: 'Soft',
            colors: ['#9B6B6B', '#9B8A6B', '#8A9B6B', '#6B9B7A', '#6B8A9B', '#6B6B9B', '#8A6B9B', '#9B6B8A'],
            sets: {
                4: ['#9B6B6B', '#8A9B6B', '#6B8A9B', '#8A6B9B'],
                5: ['#9B6B6B', '#8A9B6B', '#6B9B7A', '#6B8A9B', '#8A6B9B'],
                6: ['#9B6B6B', '#9B8A6B', '#8A9B6B', '#6B9B7A', '#6B8A9B', '#8A6B9B'],
                7: ['#9B6B6B', '#9B8A6B', '#8A9B6B', '#6B9B7A', '#6B8A9B', '#6B6B9B', '#8A6B9B'],
                8: null
            }
        },
        
        // === RETRO ===
        'retroarcade': {
            name: 'Retro Arcade',
            category: 'Retro',
            colors: ['#E60012', '#FF7900', '#FFCC00', '#00A651', '#0068B7', '#1D2088', '#920783', '#E4007F'],
            sets: {
                4: ['#E60012', '#FFCC00', '#00A651', '#0068B7'],
                5: ['#E60012', '#FFCC00', '#00A651', '#0068B7', '#920783'],
                6: ['#E60012', '#FF7900', '#FFCC00', '#00A651', '#0068B7', '#920783'],
                7: ['#E60012', '#FF7900', '#FFCC00', '#00A651', '#0068B7', '#1D2088', '#920783'],
                8: null
            }
        },
        'gameboy': {
            name: 'Gameboy',
            category: 'Retro',
            colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#8bac0f', '#306230', '#0f380f', '#9bbc0f'],
            sets: {
                4: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
                5: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#306230'],
                6: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#306230', '#0f380f'],
                7: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f', '#8bac0f', '#306230', '#0f380f'],
                8: null
            }
        },
        'c64': {
            name: 'C64',
            category: 'Retro',
            colors: ['#9F4E44', '#CB7E75', '#6D5412', '#A1683C', '#6C5EB5', '#959595', '#6ABF6A', '#50459B'],
            sets: {
                4: ['#9F4E44', '#6D5412', '#6C5EB5', '#6ABF6A'],
                5: ['#9F4E44', '#6D5412', '#6C5EB5', '#6ABF6A', '#959595'],
                6: ['#9F4E44', '#CB7E75', '#6D5412', '#6C5EB5', '#6ABF6A', '#50459B'],
                7: ['#9F4E44', '#CB7E75', '#6D5412', '#A1683C', '#6C5EB5', '#6ABF6A', '#50459B'],
                8: null
            }
        },
        
        // === MONOCHROME ===
        'monogreen': {
            name: 'Mono Green (P1)',
            category: 'Monochrome',
            colors: ['#001100', '#003300', '#005500', '#007700', '#009900', '#00BB00', '#00DD00', '#00FF00'],
            sets: {
                4: ['#003300', '#007700', '#00BB00', '#00FF00'],
                5: ['#003300', '#005500', '#009900', '#00CC00', '#00FF00'],
                6: ['#002200', '#004400', '#007700', '#00AA00', '#00DD00', '#00FF00'],
                7: ['#001100', '#003300', '#005500', '#007700', '#00AA00', '#00DD00', '#00FF00'],
                8: null
            }
        },
        'monoamber': {
            name: 'Mono Amber (P3)',
            category: 'Monochrome',
            colors: ['#1A0F00', '#331F00', '#4D2E00', '#664400', '#805500', '#B37700', '#CC8800', '#FFAA00'],
            sets: {
                4: ['#331F00', '#664400', '#B37700', '#FFAA00'],
                5: ['#331F00', '#4D2E00', '#805500', '#CC8800', '#FFAA00'],
                6: ['#1A0F00', '#3D2400', '#664400', '#996600', '#CC8800', '#FFAA00'],
                7: ['#1A0F00', '#331F00', '#4D2E00', '#664400', '#996600', '#CC8800', '#FFAA00'],
                8: null
            }
        },
        'monowhite': {
            name: 'Mono White',
            category: 'Monochrome',
            colors: ['#1A1A1A', '#333333', '#4D4D4D', '#666666', '#808080', '#B3B3B3', '#CCCCCC', '#FFFFFF'],
            sets: {
                4: ['#333333', '#666666', '#B3B3B3', '#FFFFFF'],
                5: ['#333333', '#555555', '#808080', '#CCCCCC', '#FFFFFF'],
                6: ['#222222', '#444444', '#666666', '#999999', '#CCCCCC', '#FFFFFF'],
                7: ['#1A1A1A', '#333333', '#4D4D4D', '#666666', '#999999', '#CCCCCC', '#FFFFFF'],
                8: null
            }
        },
        'monoblue': {
            name: 'Mono Blue',
            category: 'Monochrome',
            colors: ['#0A1628', '#1A365D', '#2A4A7F', '#3B5998', '#4A90D9', '#6BB3F0', '#8DD3FF', '#B8E4FF'],
            sets: {
                4: ['#1A365D', '#3B5998', '#6BB3F0', '#B8E4FF'],
                5: ['#1A365D', '#2A4A7F', '#4A90D9', '#8DD3FF', '#B8E4FF'],
                6: ['#0A1628', '#1A365D', '#3B5998', '#4A90D9', '#8DD3FF', '#B8E4FF'],
                7: ['#0A1628', '#1A365D', '#2A4A7F', '#3B5998', '#6BB3F0', '#8DD3FF', '#B8E4FF'],
                8: null
            }
        },
        'monocyan': {
            name: 'Mono Cyan',
            category: 'Monochrome',
            colors: ['#001A1A', '#003333', '#004D4D', '#006666', '#008080', '#00B3B3', '#00CCCC', '#00FFFF'],
            sets: {
                4: ['#003333', '#006666', '#00B3B3', '#00FFFF'],
                5: ['#003333', '#004D4D', '#008080', '#00CCCC', '#00FFFF'],
                6: ['#001A1A', '#003D3D', '#006666', '#009999', '#00CCCC', '#00FFFF'],
                7: ['#001A1A', '#003333', '#004D4D', '#006666', '#009999', '#00CCCC', '#00FFFF'],
                8: null
            }
        },
        'monopink': {
            name: 'Mono Pink',
            category: 'Monochrome',
            colors: ['#1A0011', '#330022', '#4D0033', '#660044', '#800055', '#B30077', '#CC0088', '#FF00AA'],
            sets: {
                4: ['#330022', '#660044', '#B30077', '#FF00AA'],
                5: ['#330022', '#4D0033', '#800055', '#CC0088', '#FF00AA'],
                6: ['#1A0011', '#3D0028', '#660044', '#990066', '#CC0088', '#FF00AA'],
                7: ['#1A0011', '#330022', '#4D0033', '#660044', '#990066', '#CC0088', '#FF00AA'],
                8: null
            }
        },
        
        // === NATURE ===
        'ocean': {
            name: 'Ocean',
            category: 'Nature',
            colors: ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#00D2D3', '#54A0FF', '#5F27CD', '#C44569'],
            sets: {
                4: ['#FF6B6B', '#FECA57', '#1DD1A1', '#54A0FF'],
                5: ['#FF6B6B', '#FECA57', '#1DD1A1', '#54A0FF', '#5F27CD'],
                6: ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#00D2D3', '#5F27CD'],
                7: ['#FF6B6B', '#FF9F43', '#FECA57', '#1DD1A1', '#00D2D3', '#54A0FF', '#5F27CD'],
                8: null
            }
        },
        'forest': {
            name: 'Forest',
            category: 'Nature',
            colors: ['#2D5A27', '#3E7A35', '#4A9B43', '#5DBB52', '#8BC34A', '#AED581', '#C5E1A5', '#DCEDC8'],
            sets: {
                4: ['#2D5A27', '#4A9B43', '#8BC34A', '#DCEDC8'],
                5: ['#2D5A27', '#3E7A35', '#5DBB52', '#AED581', '#DCEDC8'],
                6: ['#2D5A27', '#3E7A35', '#4A9B43', '#8BC34A', '#C5E1A5', '#DCEDC8'],
                7: ['#2D5A27', '#3E7A35', '#4A9B43', '#5DBB52', '#8BC34A', '#C5E1A5', '#DCEDC8'],
                8: null
            }
        },
        'earthtones': {
            name: 'Earth Tones',
            category: 'Nature',
            colors: ['#B85C38', '#E08E45', '#EDD892', '#7D9D6B', '#5B8A72', '#4A6670', '#8B6B5C', '#C4A484'],
            sets: {
                4: ['#B85C38', '#EDD892', '#5B8A72', '#4A6670'],
                5: ['#B85C38', '#E08E45', '#EDD892', '#5B8A72', '#4A6670'],
                6: ['#B85C38', '#E08E45', '#EDD892', '#7D9D6B', '#5B8A72', '#8B6B5C'],
                7: ['#B85C38', '#E08E45', '#EDD892', '#7D9D6B', '#5B8A72', '#4A6670', '#8B6B5C'],
                8: null
            }
        },
        'autumn': {
            name: 'Autumn',
            category: 'Nature',
            colors: ['#8B0000', '#CC4400', '#FF6600', '#FF9900', '#FFCC00', '#996633', '#663300', '#442200'],
            sets: {
                4: ['#8B0000', '#FF6600', '#FFCC00', '#442200'],
                5: ['#8B0000', '#CC4400', '#FF9900', '#FFCC00', '#663300'],
                6: ['#8B0000', '#CC4400', '#FF6600', '#FF9900', '#FFCC00', '#663300'],
                7: ['#8B0000', '#CC4400', '#FF6600', '#FF9900', '#FFCC00', '#996633', '#663300'],
                8: null
            }
        },
        'sunset': {
            name: 'Sunset',
            category: 'Nature',
            colors: ['#FF4E50', '#FC913A', '#F9D62E', '#EAE374', '#E2F4C7', '#A8E6CF', '#88D8B0', '#FFEAA7'],
            sets: {
                4: ['#FF4E50', '#F9D62E', '#A8E6CF', '#88D8B0'],
                5: ['#FF4E50', '#FC913A', '#F9D62E', '#A8E6CF', '#88D8B0'],
                6: ['#FF4E50', '#FC913A', '#F9D62E', '#E2F4C7', '#A8E6CF', '#88D8B0'],
                7: ['#FF4E50', '#FC913A', '#F9D62E', '#EAE374', '#E2F4C7', '#A8E6CF', '#88D8B0'],
                8: null
            }
        },
        
        // === THEMED ===
        'candy': {
            name: 'Candy',
            category: 'Themed',
            colors: ['#FF6F91', '#FF9671', '#FFC75F', '#F9F871', '#D4FC79', '#96E6A1', '#A8E6CF', '#FFB7B2'],
            sets: {
                4: ['#FF6F91', '#FFC75F', '#D4FC79', '#A8E6CF'],
                5: ['#FF6F91', '#FFC75F', '#F9F871', '#96E6A1', '#A8E6CF'],
                6: ['#FF6F91', '#FF9671', '#FFC75F', '#D4FC79', '#96E6A1', '#A8E6CF'],
                7: ['#FF6F91', '#FF9671', '#FFC75F', '#F9F871', '#D4FC79', '#96E6A1', '#A8E6CF'],
                8: null
            }
        },
        'vaporwave': {
            name: 'Vaporwave',
            category: 'Themed',
            colors: ['#FF71CE', '#FF9ECD', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96', '#F7B2BD', '#8B78E6'],
            sets: {
                4: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF'],
                5: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96'],
                6: ['#FF71CE', '#FF9ECD', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96'],
                7: ['#FF71CE', '#FF9ECD', '#01CDFE', '#05FFA1', '#B967FF', '#FFFB96', '#8B78E6'],
                8: null
            }
        },
        'synthwave': {
            name: 'Synthwave',
            category: 'Themed',
            colors: ['#FF00FF', '#FF1493', '#FF69B4', '#00FFFF', '#00CED1', '#9400D3', '#8A2BE2', '#FF4500'],
            sets: {
                4: ['#FF00FF', '#00FFFF', '#9400D3', '#FF4500'],
                5: ['#FF00FF', '#FF69B4', '#00FFFF', '#9400D3', '#FF4500'],
                6: ['#FF00FF', '#FF1493', '#00FFFF', '#00CED1', '#9400D3', '#FF4500'],
                7: ['#FF00FF', '#FF1493', '#FF69B4', '#00FFFF', '#00CED1', '#9400D3', '#FF4500'],
                8: null
            }
        },
        'ice': {
            name: 'Ice',
            category: 'Themed',
            colors: ['#E8F4F8', '#D4EAF7', '#B8DBF5', '#9ECAE1', '#6BAED6', '#4292C6', '#2171B5', '#084594'],
            sets: {
                4: ['#E8F4F8', '#9ECAE1', '#4292C6', '#084594'],
                5: ['#E8F4F8', '#B8DBF5', '#6BAED6', '#2171B5', '#084594'],
                6: ['#E8F4F8', '#D4EAF7', '#9ECAE1', '#6BAED6', '#2171B5', '#084594'],
                7: ['#E8F4F8', '#D4EAF7', '#B8DBF5', '#9ECAE1', '#4292C6', '#2171B5', '#084594'],
                8: null
            }
        },
        'fire': {
            name: 'Fire',
            category: 'Themed',
            colors: ['#FFE4B5', '#FFD700', '#FFA500', '#FF8C00', '#FF4500', '#DC143C', '#B22222', '#8B0000'],
            sets: {
                4: ['#FFD700', '#FF8C00', '#DC143C', '#8B0000'],
                5: ['#FFE4B5', '#FFA500', '#FF4500', '#B22222', '#8B0000'],
                6: ['#FFE4B5', '#FFD700', '#FFA500', '#FF4500', '#DC143C', '#8B0000'],
                7: ['#FFE4B5', '#FFD700', '#FFA500', '#FF8C00', '#FF4500', '#DC143C', '#8B0000'],
                8: null
            }
        },
        'jeweltones': {
            name: 'Jewel Tones',
            category: 'Themed',
            colors: ['#9B111E', '#E0115F', '#50C878', '#0F52BA', '#6F2DA8', '#0047AB', '#009B7D', '#E6E200'],
            sets: {
                4: ['#9B111E', '#50C878', '#0F52BA', '#E6E200'],
                5: ['#9B111E', '#E0115F', '#50C878', '#0F52BA', '#E6E200'],
                6: ['#9B111E', '#E0115F', '#50C878', '#0F52BA', '#6F2DA8', '#E6E200'],
                7: ['#9B111E', '#E0115F', '#50C878', '#0F52BA', '#6F2DA8', '#009B7D', '#E6E200'],
                8: null
            }
        },
        'galaxy': {
            name: 'Galaxy',
            category: 'Themed',
            colors: ['#0D0221', '#1A0533', '#380474', '#5C0099', '#7B2CBF', '#9D4EDD', '#C77DFF', '#E0AAFF'],
            sets: {
                4: ['#1A0533', '#5C0099', '#9D4EDD', '#E0AAFF'],
                5: ['#1A0533', '#380474', '#7B2CBF', '#C77DFF', '#E0AAFF'],
                6: ['#0D0221', '#1A0533', '#5C0099', '#9D4EDD', '#C77DFF', '#E0AAFF'],
                7: ['#0D0221', '#1A0533', '#380474', '#5C0099', '#9D4EDD', '#C77DFF', '#E0AAFF'],
                8: null
            }
        },
        'sepia': {
            name: 'Sepia',
            category: 'Themed',
            colors: ['#704214', '#8B5A2B', '#A0522D', '#B8860B', '#CD853F', '#D2B48C', '#DEB887', '#F5DEB3'],
            sets: {
                4: ['#704214', '#A0522D', '#CD853F', '#F5DEB3'],
                5: ['#704214', '#8B5A2B', '#B8860B', '#DEB887', '#F5DEB3'],
                6: ['#704214', '#8B5A2B', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3'],
                7: ['#704214', '#8B5A2B', '#A0522D', '#B8860B', '#CD853F', '#DEB887', '#F5DEB3'],
                8: null
            }
        },
        
        // === ACCESSIBILITY ===
        'colorblind1': {
            name: 'Colorblind Safe (D)',
            category: 'Accessibility',
            colors: ['#000000', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'],
            sets: {
                4: ['#E69F00', '#56B4E9', '#009E73', '#CC79A7'],
                5: ['#E69F00', '#56B4E9', '#009E73', '#D55E00', '#CC79A7'],
                6: ['#000000', '#E69F00', '#56B4E9', '#009E73', '#D55E00', '#CC79A7'],
                7: ['#000000', '#E69F00', '#56B4E9', '#009E73', '#F0E442', '#D55E00', '#CC79A7'],
                8: null
            }
        },
        'colorblind2': {
            name: 'Colorblind Safe (P)',
            category: 'Accessibility',
            colors: ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677', '#AA4499'],
            sets: {
                4: ['#332288', '#88CCEE', '#117733', '#CC6677'],
                5: ['#332288', '#88CCEE', '#44AA99', '#DDCC77', '#CC6677'],
                6: ['#332288', '#88CCEE', '#44AA99', '#117733', '#DDCC77', '#CC6677'],
                7: ['#332288', '#88CCEE', '#44AA99', '#117733', '#999933', '#DDCC77', '#CC6677'],
                8: null
            }
        },
        'colorblind3': {
            name: 'Colorblind Safe (T)',
            category: 'Accessibility',
            colors: ['#EE3377', '#009988', '#EE7733', '#33BBEE', '#CC3311', '#AADDAA', '#BBBBBB', '#882255'],
            sets: {
                4: ['#EE3377', '#009988', '#33BBEE', '#EE7733'],
                5: ['#EE3377', '#009988', '#33BBEE', '#EE7733', '#882255'],
                6: ['#EE3377', '#009988', '#EE7733', '#33BBEE', '#CC3311', '#882255'],
                7: ['#EE3377', '#009988', '#EE7733', '#33BBEE', '#CC3311', '#AADDAA', '#882255'],
                8: null
            }
        },
        'colorblinduni': {
            name: 'Colorblind Universal',
            category: 'Accessibility',
            colors: ['#56B4E9', '#E69F00', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#BBBBBB'],
            sets: {
                4: ['#56B4E9', '#E69F00', '#009E73', '#CC79A7'],
                5: ['#56B4E9', '#E69F00', '#009E73', '#D55E00', '#CC79A7'],
                6: ['#56B4E9', '#E69F00', '#009E73', '#F0E442', '#D55E00', '#CC79A7'],
                7: ['#56B4E9', '#E69F00', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'],
                8: null
            }
        },
        'a11yhighcontrast': {
            name: 'High Contrast',
            category: 'Accessibility',
            colors: ['#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF', '#FF4400', '#44FF00', '#4488FF', '#FF0044'],
            sets: {
                4: ['#FFFFFF', '#FFFF00', '#FF00FF', '#4488FF'],
                5: ['#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF', '#FF4400'],
                6: ['#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF', '#FF4400', '#4488FF'],
                7: ['#FFFFFF', '#FFFF00', '#00FFFF', '#FF00FF', '#FF4400', '#44FF00', '#4488FF'],
                8: null
            }
        }
    };
    
    // Get ordered list of categories
    const categoryOrder = ['Standard', 'Vibrant', 'Soft', 'Retro', 'Monochrome', 'Nature', 'Themed', 'Accessibility'];
    
    /**
     * Get all palette IDs
     */
    function getPaletteIds() {
        return Object.keys(palettes);
    }
    
    /**
     * Get palette by ID
     */
    function getPalette(id) {
        return palettes[id] || palettes['classic'];
    }
    
    /**
     * Get palette name by ID
     */
    function getPaletteName(id) {
        const palette = palettes[id];
        return palette ? palette.name : 'Classic';
    }
    
    /**
     * Get all colors for a palette
     */
    function getColors(paletteId) {
        const palette = palettes[paletteId] || palettes['classic'];
        return palette.colors;
    }
    
    /**
     * Get optimized color set for a specific count
     */
    function getColorSet(paletteId, count) {
        const palette = palettes[paletteId] || palettes['classic'];
        if (count >= 8 || !palette.sets[count]) {
            return palette.colors;
        }
        return palette.sets[count];
    }
    
    /**
     * Get all COLOR_SETS for a palette (for game.js compatibility)
     */
    function getColorSets(paletteId) {
        const palette = palettes[paletteId] || palettes['classic'];
        return {
            4: palette.sets[4],
            5: palette.sets[5],
            6: palette.sets[6],
            7: palette.sets[7],
            8: palette.colors
        };
    }
    
    /**
     * Get palettes grouped by category
     */
    function getPalettesByCategory() {
        const grouped = {};
        categoryOrder.forEach(cat => grouped[cat] = []);
        
        Object.entries(palettes).forEach(([id, palette]) => {
            if (grouped[palette.category]) {
                grouped[palette.category].push({
                    id: id,
                    name: palette.name,
                    colors: palette.colors
                });
            }
        });
        
        return grouped;
    }
    
    /**
     * Get category order
     */
    function getCategoryOrder() {
        return categoryOrder;
    }
    
    // Public API
    return {
        getPaletteIds,
        getPalette,
        getPaletteName,
        getColors,
        getColorSet,
        getColorSets,
        getPalettesByCategory,
        getCategoryOrder
    };
})();

// Make available globally
window.ColorPalettes = ColorPalettes;
