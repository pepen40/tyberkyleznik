# SSH-доступ друзей только к frontend

> Не требуется для обычного сайта. Это необязательная инструкция для старого
> изолированного стенда. [Текущий путь — GitHub Pages и Supabase](../docs/public-playtest.md).

Выполняет администратор отдельного тестового хоста. Нужен отдельный Unix-пользователь
на друга, без sudo/Docker и доступа к каталогу оператора. Оператор продолжает работать
через свою прежнюю SSH-учётку; не добавляйте его в группу ограничений. Эти команды
на рабочей Windows-машине/удалённом хосте автоматически не выполнялись.

## Настройка на Ubuntu

Друг генерирует ключ у себя (если отдельного ключа для теста ещё нет):

```sh
ssh-keygen -t ed25519 -f ~/.ssh/pepen_test
```

Владельцу передаётся только `pepen_test.pub`. Закрытый ключ остаётся у друга.
На сервере оператор создаёт пример учётки и ставит публичный ключ (имена можно
заменить для остальных друзей):

```sh
sudo groupadd -f pepen-test-forward
sudo adduser --disabled-password --gecos '' --ingroup pepen-test-forward friend_tunnel_one
sudo install -d -m 700 -o friend_tunnel_one -g pepen-test-forward /home/friend_tunnel_one/.ssh
```

Сохраните полученный ключ в файл `friend_one.pub` в текущем каталоге, проверьте
отпечаток с другом отдельным каналом:

```sh
ssh-keygen -lf friend_one.pub
{ printf 'restrict,port-forwarding,permitopen="127.0.0.1:8080",command="/bin/false" '; cat friend_one.pub; } > friend_one.authorized_keys
sudo install -m 600 -o friend_tunnel_one -g pepen-test-forward friend_one.authorized_keys /home/friend_tunnel_one/.ssh/authorized_keys
```

Никогда не заменяйте authorized_keys администратора. На Ubuntu проверьте, что
основной sshd_config подключает `/etc/ssh/sshd_config.d/*.conf`. Установите
репозиторный файл (если такой файл уже есть — сначала сравните и сохраните его):

```sh
sudo install -m 644 closed-test/sshd-friends.conf /etc/ssh/sshd_config.d/pepen-test-friends.conf
sudo /usr/sbin/sshd -t
sudo /usr/sbin/sshd -T -C user=friend_tunnel_one,host=localhost,addr=127.0.0.1 | grep -E '^(authenticationmethods|passwordauthentication|allowtcpforwarding|permitopen|allowstreamlocalforwarding|forcecommand|permittty|allowagentforwarding|x11forwarding) '
```

Должны быть: publickey, passwordauthentication no, allowtcpforwarding local,
permitopen 127.0.0.1:8080, allowstreamlocalforwarding no, forcecommand /bin/false,
permittty no, allowagentforwarding no, x11forwarding no. При отличиях **не**
перезагружайте конфигурацию: разберите конфликт локальной политики с администратором.
Сохраняя текущую администраторскую SSH-сессию открытой:

```sh
sudo systemctl reload ssh
```

`AllowTcpForwarding local` запрещает `-R`; `PermitOpen` ограничивает адрес назначения.
Комбинация с ключевым restrict/forced command запрещает shell, PTY, agent/X11 и
Unix-socket forwarding. Директория проекта оператора должна иметь режим 700.
Официальная семантика: https://man.openbsd.org/sshd_config и https://man.openbsd.org/sshd.8 .

## Команда друга и проверка

`TEST_HOST` ниже — адрес именно предоставленного владельцем тестового сервера.
Друг отдельно сверяет SSH host-key fingerprint с владельцем; не отключайте проверку host key.

```sh
ssh -i ~/.ssh/pepen_test -o ExitOnForwardFailure=yes -N -L 127.0.0.1:8080:127.0.0.1:8080 friend_tunnel_one@TEST_HOST
```

Открыть `http://127.0.0.1:8080`, войти выданным **игровым** ником/паролем.
SSH-учётка и игровая учётка — разные сущности. Если локальный 8080 занят, замените
только первый порт на `127.0.0.1:18080:127.0.0.1:8080` и откройте localhost:18080.
Ctrl-C закрывает туннель. Не используйте `-g` или bind `0.0.0.0` на компьютере друга.

Оператор проверяет под этой учёткой: обычная shell-команда завершается отказом;
`ssh -W 127.0.0.1:54321 friend_tunnel_one@TEST_HOST` запрещён; попытка
`ssh -o ExitOnForwardFailure=yes -N -R 127.0.0.1:18081:127.0.0.1:8080 friend_tunnel_one@TEST_HOST`
завершается отказом. Для этих проверок используйте тот же ключ через `-i`.
Положительная проверка — доступ через разрешённый туннель и реальный вход.
Не объявляйте SSH-приёмку пройденной, пока эти команды не выполнены на вашем хосте.
