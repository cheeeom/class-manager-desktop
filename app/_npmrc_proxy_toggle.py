# -*- coding: utf-8 -*-
# 临时禁用/恢复用户级 .npmrc 的死代理（构建窗口期），用后恢复
import io, sys, shutil

PATH = r'C:\Users\84669\.npmrc'
BAK = PATH + '.cm_desk_bak'
mode = sys.argv[1]

if mode == 'off':
    shutil.copyfile(PATH, BAK)
    with io.open(PATH, 'r', encoding='utf-8') as f:
        s = f.read()
    out = []
    for line in s.splitlines():
        if line.strip().lower().startswith('proxy=') or line.strip().lower().startswith('https-proxy='):
            out.append(';' + line + '  # [cm-desktop 临时禁用]')
        else:
            out.append(line)
    with io.open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write('\n'.join(out) + '\n')
    print('OK 代理已临时禁用（备份在 ' + BAK + '）')
elif mode == 'on':
    shutil.copyfile(BAK, PATH)
    print('OK 代理配置已恢复')
