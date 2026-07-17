import json
from pathlib import Path

p = Path('D:/AGeneral Workspace/xjch2026/xtch-web-portal/data/drafts/media-assets/media-assets.from-route-new.json')
with p.open('r', encoding='utf-8') as f:
    data = json.load(f)

selected = {
    '路线_新/上海/上海图片/上海旅拍/上海客拍.jpg',
    '路线_新/上海/上海图片/上海旅拍/上海外滩观景平台旅拍.jpg',
    '路线_新/北京/实拍客片/长城.png',
    '路线_新/北京/实拍客片/故宫.png',
    '路线_新/成都-川西/川西实拍客片/九寨沟.png',
    '路线_新/成都-川西/旅拍照片/稻城亚丁.png',
    '路线_新/重庆/外国人旅拍照片/武隆1.jpg',
    '路线_新/重庆/实拍客片/老外们在洪崖洞_1_Edward _ 香橙🍊_来自小红书网页版.jpg',
    '路线_新/云南/云南旅拍客拍照片/云南旅拍 客拍照片/香格里拉 (10).png',
    '路线_新/云南/云南旅拍客拍照片/云南旅拍 客拍照片/洱海 (17).png',
    '路线_新/广西/广西实拍客片/5b5f59f7d3f39237fd377655b8f32cfb.jpg',
    '路线_新/广西/广西实拍客片/桂林山水甲天下⛰️_5_敏感激_来自小红书网页版.jpg',
    '路线_新/青甘/青甘图片/青甘旅拍/鸣沙山月牙泉外国人旅拍.jpg',
    '路线_新/青甘/青甘图片/青甘客拍/察尔汗盐湖客拍1.jpg',
    '路线_新/西安/实拍客片/外国人也是对兵马俑有兴趣_1_Valeria 莉娅_来自小红书网页版.jpg',
    '路线_新/西藏-川藏/西藏实拍客片/不接受反驳❗️西藏是ChinaTravel的顶流❗️_2_亚洲奥德赛旅行_来自小红书网页版.jpg',
    '路线_新/西藏-川藏/外国人旅拍照片/My 16-year dream终于成真了！_1_功必扬_来自小红书网页版.jpg',
    '路线_新/青甘/青甘图片/青甘客拍/祁连山脉大草原客拍.jpg',
}

updated = 0
for asset in data['assets']:
    if asset.get('originalPath') in selected:
        asset['status'] = 'published'
        asset['rightsStatus'] = 'syncing-owned'
        updated += 1

with p.open('w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Updated {updated} assets')
