module Authorisation.Suggest.View exposing (view)

import Authorisation.Suggest.Resource as Resource
import Branding
import Dict
import External.Context exposing (Context, defaultFailedState)
import FeatherIcons
import Html exposing (Html)
import Html.Attributes as A
import Html.Events as E
import Html.Extra as Html
import Icons
import List.Ext as List
import List.Extra as List
import Loading
import Maybe.Extra as Maybe
import Radix exposing (..)
import RemoteData exposing (RemoteData(..))
import Styling as S
import Tailwind as T
import Time
import Time.Distance
import Time.Distance.I18n



-- 🖼


view : Context -> Model -> Html Msg
view context model =
    Html.div
        [ T.text_center ]
        [ Branding.logo model

        -----------------------------------------
        -- Name & Duration
        -----------------------------------------
        , let
            hasResources =
                Maybe.isJust context.app
                    || not (List.isEmpty context.privatePaths)
                    || not (List.isEmpty context.publicPaths)

            label =
                Html.span
                    [ T.font_semibold
                    , T.text_black

                    -- Dark mode
                    ------------
                    , T.dark__text_white
                    ]
                    (context
                        |> appNameLabel
                        |> Maybe.withDefault (originLabel context)
                    )
          in
          if hasResources then
            Html.div
                [ T.mt_10 ]
                [ Html.text "Allow "
                , label

                --
                , Html.text " access to the following for "
                , Html.text <|
                    Time.Distance.inWordsWithConfig
                        { withAffix = False }
                        Time.Distance.I18n.en
                        (Time.millisToPosix 0)
                        (Time.millisToPosix <| context.lifetimeInSeconds * 1000)

                --
                , Html.text "?"
                ]

          else
            Html.div
                [ T.mt_10 ]
                [ Html.text "Allow "
                , label
                , Html.text " to authenticate with this account?"
                ]

        -----------------------------------------
        -- Resources
        -----------------------------------------
        , [ Maybe.unwrap Html.nothing Resource.applicationFolder context.app
          ]
            |> List.prepend
                (List.map
                    (Resource.fileSystemPath Resource.Private)
                    context.privatePaths
                )
            |> List.prepend
                (List.map
                    (Resource.fileSystemPath Resource.Public)
                    context.publicPaths
                )
            |> Html.ul
                [ T.italic
                , T.leading_snug
                , T.max_w_md
                , T.mt_6
                , T.mx_auto
                , T.rounded_md
                , T.shadow
                , T.text_gray_200
                , T.text_left
                , T.text_sm

                -- Dark mode
                ------------
                , T.dark__text_gray_400
                ]

        --
        , if List.any ((==) "/") context.privatePaths then
            Html.div
                [ T.bg_yellow_tint
                , T.flex
                , T.italic
                , T.items_center
                , T.max_w_md
                , T.mt_6
                , T.mx_auto
                , T.p_4
                , T.rounded_md
                , T.relative
                , T.shadow_sm
                , T.text_left
                , T.text_sm
                , T.text_yellow_shade

                -- Dark mode
                ------------
                , T.dark__bg_yellow_shade
                , T.dark__text_yellow
                ]
                [ Icons.wrap
                    [ T.align_middle
                    , T.inline_block
                    , T.mr_3
                    , T.opacity_60
                    ]
                    (FeatherIcons.withSize 14 FeatherIcons.alertTriangle)
                , Html.span
                    [ T.opacity_75 ]
                    [ Html.text """
                        This application will have access to all your private files. Make sure you trust this app before you grant permission.
                      """
                    , Html.text " "
                    , Html.a
                        [ A.href "https://guide.fission.codes/accounts#app-permissions"
                        , A.target "_blank"
                        , T.underline
                        ]
                        [ Html.text "Learn more" ]
                    , Html.text ""
                    ]
                ]

          else
            Html.nothing

        -----------------------------------------
        -- Buttons
        -----------------------------------------
        , Html.div
            [ T.flex
            , T.justify_center
            , T.mt_10
            ]
            [ S.button
                [ E.onClick AllowAuthorisation

                --
                , T.bg_purple
                , T.flex
                , T.items_center

                -- Dark mode
                ------------
                , T.dark__bg_purple_shade
                ]
                [ S.buttonIcon FeatherIcons.check
                , Html.text "Yes"
                ]

            --
            , S.button
                [ E.onClick DenyAuthorisation

                --
                , T.bg_gray_400
                , T.flex
                , T.items_center
                , T.ml_3

                -- Dark mode
                ------------
                , T.dark__bg_gray_200
                ]
                [ S.buttonIcon FeatherIcons.x
                , Html.text "No"
                ]
            ]
        ]


originLabel : Context -> List (Html Msg)
originLabel context =
    [ Html.text context.redirectTo.host
    , Html.text (Maybe.unwrap "" (String.fromInt >> (++) ":") context.redirectTo.port_)
    ]


appNameLabel : Context -> Maybe (List (Html Msg))
appNameLabel context =
    context.app
        |> Maybe.andThen (String.split "/" >> List.getAt 1)
        |> Maybe.map (Html.text >> List.singleton)
