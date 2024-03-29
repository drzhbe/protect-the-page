<script lang="ts">
  import { onMount } from "svelte";
  import { isInRange } from "./base";
  import type { Id, Position } from "./types";
  import { text } from "./texts/john1";

  let clientWidth = document.body.clientWidth;
  let clientHeight = document.body.clientHeight;
  let canvas;
  let ctx;

  let nextId = 0;
  let tick = 0;
  let spawnFrequency = 6 * 10 * 1000;
  let waveSize = 5;
  let creatureSpeed = 0.0005;

  const textToSpeak = new SpeechSynthesisUtterance();
  textToSpeak.rate = 0.1;
  const speak = (text: string) => {
    textToSpeak.text = text;
    speechSynthesis.speak(textToSpeak);
  };

  const waves = text
    .split("\n")
    .map((line) =>
      line
        .split(" ")
        .flatMap((word) =>
          word
            .split("\n")
            .map((word) => word.replaceAll(/\W/g, "").toUpperCase())
        )
    )
    .flatMap((wave) => {
      const subwaves = [];
      for (let i = 0; i < wave.length; i += waveSize) {
        subwaves.push(wave.slice(i, i + waveSize));
      }
      return subwaves;
    });

  let magicPagePosition: Position = { x: clientWidth / 2, y: clientHeight / 2 };
  let magicPageRange = 100;

  let player1IsMoving = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  let player1Position: Position = { x: 0, y: 0 };
  let player1Range = 150;
  let player1Speed = 2; // px per tick
  let aliveCreatures: Id[] = [];
  let collectedCreatures: Id[] = [];
  let dirtyCreatures: Id[] = [];
  let countCollectedCreatures: Record<string, number> = {};
  let creaturesInRangeOfPlayer1: Record<Id, boolean> = {};
  let hits: Record<Id, number> = {}; // How many letters in a word have been hit.
  let positions: Record<Id, Position> = {};
  let contents: Record<Id, string> = {};

  function reset() {
    player1Position = { x: 0, y: 0 };
    aliveCreatures = [];
    collectedCreatures = [];
    dirtyCreatures = [];
    countCollectedCreatures = {};
    creaturesInRangeOfPlayer1 = {};
    positions = {};
    contents = {};
  }

  $: {
    const newCountCollectedCreatures: Record<string, number> = {};
    for (const id of collectedCreatures) {
      const key = contents[id];
      newCountCollectedCreatures[key] =
        (newCountCollectedCreatures[key] || 0) + 1;
    }
    countCollectedCreatures = newCountCollectedCreatures;
  }
  $: uniqueCollectedCreatures = Object.keys(countCollectedCreatures).sort(
    (a, b) => a.localeCompare(b)
  );

  const slate200 = "#e2e8f0";
  const slate500 = "#64748b";

  const maybeUpdateCreaturesInRange = (
    position: Position,
    range: number,
    creatures: Id[]
  ) => {
    for (const id of creatures) {
      creaturesInRangeOfPlayer1[id] = isInRange(position, positions[id], range);
    }
  };

  const maybeUpdateDirtyCreatures = (
    position: Position,
    range: number,
    creatures: Id[]
  ) => {
    for (const id of creatures) {
      const inRange = isInRange(position, positions[id], range);
      if (inRange) {
        const index = aliveCreatures.indexOf(id);
        aliveCreatures.splice(index, 1);
        dirtyCreatures = [...dirtyCreatures, id];
        delete creaturesInRangeOfPlayer1[id];
        delete positions[id];
      }
    }
  };

  onMount(() => {
    ctx = canvas.getContext("2d");
    canvas.width = clientWidth * window.devicePixelRatio;
    canvas.height = clientHeight * window.devicePixelRatio;
    canvas.style.width = clientWidth + "px";
    canvas.style.height = clientHeight + "px";
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    let frame = requestAnimationFrame(render);
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { x, y } = player1Position;
      // Player range.
      ctx.fillStyle = `${slate200}33`;
      ctx.beginPath();
      ctx.arc(x, y, player1Range, 0, 2 * Math.PI);
      ctx.fill();

      // Player.
      ctx.fillStyle = slate500;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = slate200;
      ctx.font = "30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✏️", x, y);

      // Creatures.
      for (const id of aliveCreatures) {
        const { x, y } = positions[id];
        const content = contents[id];

        // ctx.fillStyle = creaturesInRangeOfPlayer1[id]
        //   ? `${slate500}55`
        //   : `${slate200}55`;
        // ctx.beginPath();
        // ctx.arc(x, y, 30, 0, 2 * Math.PI);
        // ctx.fill();
        const w = ctx.measureText(content).width;
        const h = 30;
        const p = 4; // padding

        // For creatures in range draw a background.
        if (creaturesInRangeOfPlayer1[id]) {
          ctx.fillStyle = slate500;
          ctx.beginPath();
          ctx.roundRect(x - w / 2 - p, y - h / 2 - p, w + p * 2, h + p * 2, 4);
          ctx.fill();
        }

        const hitIndex = hits[id] || 0;
        const hit = content.substring(0, hitIndex);
        const rest = content.substring(hitIndex);

        ctx.font = "30px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const hitWidth = ctx.measureText(hit).width;
        const restWidth = ctx.measureText(rest).width;
        if (hitIndex) {
          ctx.fillStyle = creaturesInRangeOfPlayer1[id]
            ? `${slate200}55`
            : `${slate500}55`;
          ctx.fillText(hit, x - restWidth / 2, y);
        }

        ctx.fillStyle = creaturesInRangeOfPlayer1[id] ? slate200 : slate500;
        ctx.fillText(rest, x + hitWidth / 2, y);
      }

      frame = requestAnimationFrame(render);
    }

    const eventLoopInterval = setInterval(() => {
      tick += 1;

      // Move player.
      player1IsMoving.up && (player1Position.y -= player1Speed);
      player1IsMoving.down && (player1Position.y += player1Speed);
      player1IsMoving.left && (player1Position.x -= player1Speed);
      player1IsMoving.right && (player1Position.x += player1Speed);

      // Move creatures.
      const target: Position = { x: clientWidth / 2, y: clientHeight / 2 };
      for (let id of aliveCreatures) {
        const { x, y } = positions[id];
        const newX = x + (target.x - x) * creatureSpeed;
        const newY = y + (target.y - y) * creatureSpeed;
        positions[id] = { x: newX, y: newY };
      }

      maybeUpdateCreaturesInRange(
        player1Position,
        player1Range,
        aliveCreatures
      );

      maybeUpdateDirtyCreatures(
        magicPagePosition,
        magicPageRange,
        aliveCreatures
      );

      if (!aliveCreatures.length) {
        spawnCreatures();
      }
    }, 16);

    let spawnTimeout: NodeJS.Timeout;
    const spawnCreatures = () => {
      const wave = waves.shift();
      wave?.forEach((content) => {
        const id = nextId;
        nextId += 1;
        const x = Math.random() * clientWidth;
        const y = Math.random() * clientHeight;
        positions[id] = { x, y };
        contents[id] = content;
        aliveCreatures = [...aliveCreatures, id];
      });
      clearTimeout(spawnTimeout);
      spawnTimeout = setTimeout(spawnCreatures, spawnFrequency);
    };

    spawnCreatures();

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = e;
      player1Position = { x, y };
      maybeUpdateCreaturesInRange(
        player1Position,
        player1Range,
        aliveCreatures
      );
    };

    const onKeyDownMovePlayer = (e: KeyboardEvent) => {
      if (e.keyCode >= 37 && e.keyCode <= 40) {
        switch (e.key) {
          case "ArrowUp":
            player1IsMoving["up"] = true;
            break;
          case "ArrowDown":
            player1IsMoving["down"] = true;
            break;
          case "ArrowLeft":
            player1IsMoving["left"] = true;
            break;
          case "ArrowRight":
            player1IsMoving["right"] = true;
            break;
        }

        e.preventDefault();
        return;
      }
    };
    const onKeyUpMovePlayer = (e: KeyboardEvent) => {
      if (e.keyCode >= 37 && e.keyCode <= 40) {
        switch (e.key) {
          case "ArrowUp":
            player1IsMoving["up"] = false;
            break;
          case "ArrowDown":
            player1IsMoving["down"] = false;
            break;
          case "ArrowLeft":
            player1IsMoving["left"] = false;
            break;
          case "ArrowRight":
            player1IsMoving["right"] = false;
            break;
        }

        e.preventDefault();
        return;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode >= 65 && e.keyCode <= 90) {
        for (const id_ in creaturesInRangeOfPlayer1) {
          const id = Number(id_);
          if (!creaturesInRangeOfPlayer1[id]) continue;

          const content = contents[id];
          const char = content[hits[id] || 0].toLowerCase();
          if (char === e.key) {
            hits[id] = (hits[id] || 0) + 1;

            speak(char);

            if (hits[id] === content.length) {
              speak(content);

              collectedCreatures = [...collectedCreatures, id];
              delete creaturesInRangeOfPlayer1[id];
              delete positions[id];
              delete hits[id];
              const index = aliveCreatures.indexOf(id);
              aliveCreatures.splice(index, 1);
            }
            break;
          }
        }
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keydown", onKeyDownMovePlayer);
    document.addEventListener("keyup", onKeyUpMovePlayer);

    return () => {
      clearTimeout(spawnTimeout);
      clearInterval(eventLoopInterval);
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onKeyDownMovePlayer);
      document.removeEventListener("keyup", onKeyUpMovePlayer);
    };
  });
</script>

<main>
  <div class="magic-page">
    {#each dirtyCreatures as id}
      <div>{contents[id]}</div>
    {/each}
  </div>
  <canvas bind:this={canvas} />
  <div class="collection">
    {#each uniqueCollectedCreatures as content}
      <div>
        <div class="creature">
          {content}
        </div>
        <div class="count">{countCollectedCreatures[content]}</div>
      </div>
    {/each}
  </div>
  {#if dirtyCreatures.length > 10}
    <div class="game-over">
      <div>Game Over</div>
      <button on:click={reset}>Start again</button>
    </div>
  {/if}
</main>

<style>
  :root {
    --slate200: #e2e8f0;
    --slate500: #64748b;
  }

  .magic-page {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    border-radius: 8px;
    border: 2px solid var(--slate500);
    padding: 8px;
    width: 200px;
    height: 200px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    word-break: break-word;
    font-family: monospace;
    color: var(--slate500);
  }

  .collection {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    padding: 8px;
    background-color: var(--slate200);
    opacity: 0.75;
    border-radius: 4px;
    max-width: 145px;
  }
  .collection .creature {
    padding: 0 8px;
    border-radius: 4px;
    background-color: var(--slate500);
    color: white;
    font-family: "Courier New", Courier, monospace;
  }

  .game-over {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    background-color: var(--slate200);
    padding: 64px;
    border-radius: 8px;
    opacity: 0.95;
    font-size: 4rem;
    line-height: 6rem;
  }
</style>
