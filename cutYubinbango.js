// --- ここから追加⭐️⭐️⭐️：ZipCloud APIによる住所自動入力ロジック ---
            if (form) {
                const zipInputForApi = form.querySelector('input[name="zip"]');
                const stateInput = form.querySelector('select[name="state"]') || form.querySelector('input[name="state"]');
                const cityInput = form.querySelector('input[name="city"]');
                // address_textが存在しない場合のフォールバックとしてaddressも考慮
                const addressInput = form.querySelector('input[name="address_text"]') || form.querySelector('input[name="address"]');

                if (zipInputForApi && stateInput && cityInput && addressInput) {
                    zipInputForApi.addEventListener("blur", function () {
                        // 全角数字を半角数字に変換し、ハイフンを消す
                        const zipValue = this.value
                            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
                                String.fromCharCode(s.charCodeAt(0) - 0xfee0),
                            )
                            .replace(/[^0-9]/g, "");
                        
                        // バリデーション用ロジックとは独立して値をセット（UX向上）
                        // ただし、バリデーションロジックはinputイベントで発火するため、
                        // ここで値を書き換えた場合は別途inputイベントを発火させたほうが親切だが、
                        // HubSpotのフィールド制御と競合しないよう、ここでは値の整形とAPIコールに留める。

                        if (!zipValue || isNaN(zipValue)) {
                            // API処理としては警告を出して終了（バリデーションエラーは既存ロジックが担当）
                            console.warn("郵便番号が正しくありません");
                            return;
                        } else if (zipValue.length !== 7) {
                            console.warn("郵便番号の桁数が正しくありません");
                            return;
                        }
                        console.log("⭐️⭐️⭐️⭐️⭐️zipValue",zipValue)

                        const callbackName = "zipcloud_callback_" + zipValue;

                        // コールバック関数定義
                        window[callbackName] = function (addr) {
                            const updateZipCodeField = (data) => {
                                // 値をセット
                                // ZipCloud: address1=都道府県, address2=市区町村, address3=町域
                                stateInput.value = data.address1 || "";
                                cityInput.value = data.address2 || "";
                                addressInput.value = data.address3 || "";

                                // HubSpotに通知（イベント発火）
                                // React等の仮想DOMが変更を検知するために必要
                                [stateInput, cityInput, addressInput].forEach((field) => {
                                    field.dispatchEvent(
                                        new Event("input", { bubbles: true, cancelable: true }),
                                    );
                                    field.dispatchEvent(
                                        new Event("change", { bubbles: true, cancelable: true }),
                                    );
                                });
                            };

                            if (addr && addr.results && addr.results.length > 0) {
                                console.log("⭐️⭐️⭐️⭐️⭐️⭐️addr", addr);
                                switch (addr.results.length) {
                                    case 0:
                                        console.warn("該当する住所が見つかりませんでした。");
                                        break;

                                    case 1:
                                        updateZipCodeField(addr.results[0]);
                                        break;

                                    default:
                                        // 複数件ヒット時のポップアップ処理
                                        const overlay = document.createElement("div");
                                        overlay.className = "zipcloud-overlay";

                                        // オーバーレイ削除と、ESCキー監視の解除を同時に行います
                                        const closeModal = () => {
                                            if (overlay.parentNode) {
                                                document.body.removeChild(overlay);
                                            }
                                            document.removeEventListener("keydown", onEscKey);
                                        };

                                        // --- ESCキーで閉じる ---
                                        const onEscKey = (e) => {
                                            if (e.key === "Escape") {
                                                e.preventDefault();
                                                closeModal();
                                            }
                                        };
                                        document.addEventListener("keydown", onEscKey);

                                        // --- オーバーレイ（外側）クリックで閉じる ---
                                        overlay.onclick = (e) => {
                                            if (e.target === overlay) {
                                                e.preventDefault();
                                                closeModal();
                                            }
                                        };

                                        // モーダル本体
                                        const modal = document.createElement("div");
                                        modal.className = "zipcloud-modal";

                                        modal.innerHTML ='<h3 class="zipcloud-title">以下の住所から選択してください</h3>';

                                        const fragment = document.createDocumentFragment();

                                        // ボタン生成ループ
                                        addr.results.forEach((result) => {
                                            const btn = document.createElement("button");
                                            btn.textContent =
                                                result.address1 + result.address2 + result.address3;

                                            btn.className = "zipcloud-btn";

                                            // クリックイベント
                                            btn.onclick = (e) => {
                                                e.preventDefault();
                                                updateZipCodeField(result);
                                                closeModal();
                                            };
                                            fragment.appendChild(btn);
                                        });

                                        modal.appendChild(fragment);

                                        // キャンセルボタン
                                        const closeBtn = document.createElement("button");
                                        closeBtn.textContent = "キャンセル";
                                        closeBtn.className = "zipcloud-cancel-btn";

                                        closeBtn.onclick = (e) => {
                                            e.preventDefault();
                                            closeModal();
                                        };
                                        modal.appendChild(closeBtn);

                                        overlay.appendChild(modal);
                                        document.body.appendChild(overlay);

                                        // モーダル内の最初のボタンにフォーカスを当てる（アクセシビリティ向上）
                                        setTimeout(() => {
                                            const firstBtn = modal.querySelector('button');
                                            if (firstBtn) firstBtn.focus();
                                        }, 10);
                                        break;
                                }
                            } else {
                                console.warn("ZipCloud: 該当なし。該当する住所が見つかりませんでした。", addr);
                            }

                            // クリーンアップ
                            document.body.removeChild(scriptTag);
                            delete window[callbackName];
                        };

                        // APIリクエスト
                        const scriptTag = document.createElement("script");
                        scriptTag.src =
                            "https://zipcloud.ibsnet.co.jp/api/search?zipcode=" +
                            zipValue +
                            "&callback=" +
                            callbackName;

                        scriptTag.onerror = function () {
                            console.error("API_ERROR: リクエスト失敗");
                            document.body.removeChild(scriptTag);
                            delete window[callbackName];
                        };
                        document.body.appendChild(scriptTag);
                    });
                }
            }
            // --- ここまで追加⭐️⭐️⭐️：ZipCloud APIによる住所自動入力ロジック ---
