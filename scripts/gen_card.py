#!/usr/bin/env /usr/bin/python3
"""
Beautiful styled Bitcoin Lightning payment cards
Generates stunning dark-mode receipts with gradients, rounded corners,
and clean typography -- delivered as media images.
"""

from PIL import Image, ImageDraw, ImageFont
import sys, os, datetime

def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def load_font(path, size):
    try:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    except:
        pass
    return ImageFont.load_default()

def get_fonts():
    return {
        'title_bold': load_font('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 28),
        'title': load_font('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 24),
        'amount': load_font('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 42),
        'body': load_font('/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf', 17),
        'small': load_font('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 14),
        'emoji': load_font('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 36),
        'emoji_small': load_font('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 20),
    }

def draw_gradient_bg(draw, width, height, top_color, bottom_color):
    for y in range(height):
        ratio = y / height
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * ratio)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * ratio)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

def create_accent_line(draw, x1, x2, y, height, color1, color2):
    for x in range(x1, x2):
        ratio = (x - x1) / (x2 - x1)
        r = int(color1[0] + (color2[0] - color1[0]) * ratio)
        g = int(color1[1] + (color2[1] - color1[1]) * ratio)
        b = int(color1[2] + (color2[2] - color1[2]) * ratio)
        draw.rectangle([x, y, x, y + height - 1], fill=(r, g, b))

def create_payment_card(**kwargs):
    W, H = 800, 560
    pad = 30
    card_w = W - 2 * pad
    card_h = H - 2 * pad
    radius = 28

    bg_top = (13, 13, 43)
    bg_bot = (8, 4, 28)
    card_bg = (22, 22, 52)
    accent = (247, 147, 26)  # Bitcoin orange
    accent2 = (139, 92, 246)  # Purple
    white = (255, 255, 255)
    light_gray = (170, 170, 200)
    mid_gray = (100, 100, 140)
    dim_gray = (80, 80, 110)

    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient_bg(draw, W, H, bg_top, bg_bot)

    # Glow behind card
    glow = Image.new('RGBA', (card_w + 60, card_h + 60), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle((30, 30, card_w + 30, card_h + 30), radius=radius + 15,
                                fill=(247, 147, 26, 25))
    img.paste(glow, (pad - 30, pad - 30), glow)

    # Card background
    draw.rounded_rectangle((pad, pad, pad + card_w, pad + card_h),
                          radius=radius, fill=card_bg)

    # Top accent line with gradient
    line_start = pad + radius + 15
    line_end = pad + card_w - radius - 15
    create_accent_line(draw, line_start, line_end, pad, 4, accent, accent2)

    fonts = get_fonts()
    emoji_font = fonts['emoji']

    # Lightning emoji
    draw.text((pad + 45, pad + 55), '⚡', fill=accent, font=emoji_font)

    # Card type
    card_type = kwargs.get('type', 'payment')  # payment, received, balance, invoice
    if card_type == 'payment':
        title = 'PAYMENT SENT'
    elif card_type == 'received':
        title = 'PAYMENT RECEIVED'
    elif card_type == 'balance':
        title = 'WALLET BALANCE'
    elif card_type == 'invoice':
        title = 'INVOICE CREATED'
    elif card_type == 'verified':
        title = 'PAYMENT VERIFIED'
    else:
        title = kwargs.get('title', title)

    draw.text((pad + 45 + 50, pad + 60), title, fill=white, font=fonts['title_bold'])

    # Status badge
    status = kwargs.get('status')
    if status:
        badge_y = pad + 115
        badge_x = pad + 45
        
        if 'Settled' in status or '✅' in status or 'Valid' in status:
            badge_fill = (0, 180, 100)
            badge_text = status
        elif 'Pending' in status or '⏳' in status:
            badge_fill = (200, 150, 0)
            badge_text = status
        elif 'Failed' in status or '❌' in status:
            badge_fill = (220, 50, 50)
            badge_text = status
        else:
            badge_fill = accent
            badge_text = status

        badge_text_w = draw.textlength(badge_text, font=fonts['body'])
        draw.rounded_rectangle((badge_x, badge_y, badge_x + badge_text_w + 24, badge_y + 30),
                              radius=15, fill=(*badge_fill, 60))
        draw.rounded_rectangle((badge_x, badge_y, badge_x + badge_text_w + 24, badge_y + 30),
                              radius=15, outline=badge_fill, width=1)
        draw.text((badge_x + 12, badge_y + 4), badge_text, fill=white, font=fonts['body'])

    # Amount
    sats = kwargs.get('sats')
    amount_y = pad + 160
    if sats:
        sats_int = int(sats)
        if card_type in ('payment', 'paid'):
            sign = '-'
        elif card_type == 'received':
            sign = '+'
        else:
            sign = ''
        amt_text = f"{sign}{sats_int:,} sats"
        amt_w = draw.textlength(amt_text, font=fonts['amount'])
        draw.text(((W - amt_w) / 2, amount_y), amt_text, fill=accent, font=fonts['amount'])

    # Fiat equivalent
    fiat = kwargs.get('fiat')
    if fiat:
        fiat_y = amount_y + 50
        fiat_text = f"~ ${fiat} USD"
        fiat_w = draw.textlength(fiat_text, font=fonts['title'])
        draw.text(((W - fiat_w) / 2, fiat_y), fiat_text, fill=light_gray, font=fonts['title'])

    # Divider
    div_y = pad + 260
    for x in range(pad + 40, pad + card_w - 40):
        draw.point((x, div_y), fill=dim_gray)

    # Details
    details = []
    if kwargs.get('address') or kwargs.get('to'):
        addr = kwargs.get('address') or kwargs.get('to')
        details.append(('To', addr))
    if kwargs.get('description'):
        details.append(('Description', kwargs['description']))
    if kwargs.get('fees'):
        details.append(('Fees', kwargs['fees']))
    if kwargs.get('time'):
        details.append(('Time', kwargs['time']))
    if kwargs.get('preimage'):
        pi = kwargs['preimage']
        short = pi[:12] + '...' + pi[-6:] if len(pi) > 19 else pi
        details.append(('Preimage', short))
    if kwargs.get('tx_count'):
        details.append(('Transactions', kwargs['tx_count']))

    y = div_y + 25
    for label, value in details:
        draw.text((pad + 45, y), label, fill=mid_gray, font=fonts['body'])
        draw.text((pad + 45, y + 22), str(value), fill=white, font=fonts['body'])
        y += 48

    # Bottom footer divider
    for x in range(pad + 40, pad + card_w - 40):
        draw.point((x, y + 15), fill=dim_gray)

    # Footer
    footer_text = f"Bitcoin Lightning Network"
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    footer_full = f"{footer_text}  •  {now}"
    ft_w = draw.textlength(footer_full, font=fonts['small'])
    draw.text(((W - ft_w) / 2, y + 22), footer_full, fill=mid_gray, font=fonts['small'])

    # Save
    output = kwargs.get('output', f"/tmp/lightning_{card_type}_{int(datetime.datetime.now().timestamp())}.png")
    img.convert('RGB').save(output, quality=95)
    print(output)
    return output

if __name__ == '__main__':
    args = {}
    for a in sys.argv[1:]:
        if '=' in a:
            k, v = a.split('=', 1)
            args[k.strip()] = v.strip()
    
    card_type = args.pop('type', 'payment')
    args.pop('output', None)
    create_payment_card(type=card_type, **args)
