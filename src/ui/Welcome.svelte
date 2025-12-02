<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  /** 「Modsを表示する」ボタンが押されたら ready イベントを親に通知 */
  function handleClick() {
    dispatch("ready");
  }
</script>

<div class="welcome-screen">
  <div class="welcome-logo">Nods</div>
  <div class="welcome-message">ようこそ Nods へ</div>

  <button class="welcome-button" on:click={handleClick}>
    Nods を表示する
  </button>
</div>

<style>
  .welcome-screen {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    animation: fadeIn 0.8s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95);}
    to   { opacity: 1; transform: scale(1);}
  }
  .welcome-logo {
    font-size: 3rem;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  .welcome-message {
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }
  .welcome-button {
    padding: 0.6rem 1.4rem;
    font-size: 1rem;
    border: none;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .welcome-button:hover {
    background: var(--interactive-accent-hover);
  }
</style>
