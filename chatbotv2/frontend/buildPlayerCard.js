        function buildPlayerCard(player) {
            const card = document.createElement('section');
            card.className = 'player-card';

            const nameLine = document.createElement('div');
            nameLine.className = 'player-line';
            nameLine.innerHTML = `<strong>${player.championName}</strong><span>${player.summonerName}</span>`;

            const kdaLine = document.createElement('div');
            kdaLine.className = 'player-line';
            kdaLine.innerHTML = `<span>KDA</span><strong>${player.kills}/${player.deaths}/${player.assists}</strong>`;

            const positionLine = document.createElement('div');
            positionLine.className = 'player-line';
            positionLine.innerHTML = `<span>Role</span><strong>${player.position}</strong>`;

            const itemsMeta = document.createElement('div');
            itemsMeta.className = 'player-meta';
            itemsMeta.innerHTML = `
                <div><span>Items</span><strong>${player.items || 'None'}</strong></div>
            `;

            card.append(nameLine, kdaLine, positionLine, itemsMeta);
            return card;
        }
